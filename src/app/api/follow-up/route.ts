import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  createFollowUpTemplate,
  FOLLOW_UP_SETTINGS_COLUMNS,
  refreshFollowUpTemplateStatus,
  settingsFromRow,
} from '@/lib/followUp';
import { parseFollowUpMessage, validateFollowUpFields } from '@/lib/followUpRules';

export const dynamic = 'force-dynamic';

const PERIODS = [7, 30, 90];

type OriginStats = { sent: number; recovered: number; pending: number; repliedBefore: number; avoided: number; failed: number };

const emptyStats = (): OriginStats => ({ sent: 0, recovered: 0, pending: 0, repliedBefore: 0, avoided: 0, failed: 0 });

/** Configuração, situação da mensagem de campanha na Meta, métricas e fila recente. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const requested = Number(new URL(req.url).searchParams.get('days'));
    const days = PERIODS.includes(requested) ? requested : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const settingsRes = await supabaseAdmin
      .from('follow_up_settings')
      .select(FOLLOW_UP_SETTINGS_COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (settingsRes.error?.code === '42P01') {
      return NextResponse.json(
        { success: false, error: 'O follow-up ainda não foi ativado no banco de dados (migration pendente).' },
        { status: 503 }
      );
    }

    // Abrir a tela já confere se a Meta aprovou a mensagem de campanha.
    const campaignMessageStatus = await refreshFollowUpTemplateStatus(
      tenantId,
      (settingsRes.data as { template_id?: string | null } | null)?.template_id || null
    );

    const [freshSettings, tenantRes, statsRes, recentRes] = await Promise.all([
      supabaseAdmin.from('follow_up_settings').select(FOLLOW_UP_SETTINGS_COLUMNS).eq('tenant_id', tenantId).maybeSingle(),
      supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      supabaseAdmin
        .from('follow_ups')
        .select('origin, status, skip_code, replied_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', since)
        .limit(20_000),
      supabaseAdmin
        .from('follow_ups')
        .select(
          'id, lead_id, status, skip_code, origin, due_at, sent_at, replied_at, error_message, created_at, leads(name, phone, follow_up_paused)'
        )
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(30),
    ]);

    const stats = { all: emptyStats(), CONVERSATION: emptyStats(), CAMPAIGN: emptyStats() };
    for (const row of statsRes.data || []) {
      const buckets = [stats.all, stats[row.origin === 'CAMPAIGN' ? 'CAMPAIGN' : 'CONVERSATION']];
      for (const s of buckets) {
        if (row.status === 'PENDING' || row.status === 'PROCESSING') s.pending += 1;
        else if (row.status === 'SENT') {
          s.sent += 1;
          if (row.replied_at) s.recovered += 1;
        } else if (row.status === 'REPLIED') s.repliedBefore += 1;
        else if (row.status === 'SKIPPED') s.avoided += 1;
        else if (row.status === 'FAILED') s.failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      settings: settingsFromRow(freshSettings.data as Record<string, unknown> | null),
      campaignMessageStatus,
      aiAvailable: Boolean(process.env.GEMINI_API_KEY),
      companyName: tenantRes.data?.name || '',
      days,
      stats,
      recent: recentRes.data || [],
      canEdit: auth.session.role === 'ADMIN' || auth.session.role === 'SUPER_ADMIN',
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.follow-up.get', error);
  }
}

/**
 * Salva a configuração (só administrador). Se o texto do follow-up de
 * campanha mudou, cria um template novo na Meta (aprovação automática).
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fields = validateFollowUpFields(body);
    if (!fields.ok) return NextResponse.json({ success: false, error: fields.error }, { status: 400 });

    const { data: current } = await supabaseAdmin
      .from('follow_up_settings')
      .select(FOLLOW_UP_SETTINGS_COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const saved = settingsFromRow(current as Record<string, unknown> | null);

    // Conversa: texto livre, sem aprovação.
    const rawConversation = String(body.conversation_message ?? '').trim();
    let conversationMessage = '';
    if (rawConversation) {
      const parsed = parseFollowUpMessage(rawConversation, { forTemplate: false });
      if (!parsed.ok) return NextResponse.json({ success: false, error: `Conversa: ${parsed.error}` }, { status: 400 });
      conversationMessage = parsed.text;
    } else if (fields.fields.conversation_enabled) {
      return NextResponse.json(
        { success: false, error: 'Escreva a mensagem do follow-up de conversa antes de ligar.' },
        { status: 400 }
      );
    }

    // Campanha: o texto vira template na Meta.
    const rawCampaign = String(body.campaign_message ?? '').trim();
    let campaignMessage = saved.campaign_message;
    let templateId = saved.template_id;
    let templateParams = saved.template_params;
    let templateNote = saved.template_note;
    if (rawCampaign) {
      const parsed = parseFollowUpMessage(rawCampaign, { forTemplate: true });
      if (!parsed.ok) return NextResponse.json({ success: false, error: `Campanha: ${parsed.error}` }, { status: 400 });
      const unchanged = parsed.text === saved.campaign_message && saved.template_id && !saved.template_note;
      if (!unchanged) {
        const created = await createFollowUpTemplate(tenantId, parsed.text);
        if (!created.ok) return NextResponse.json({ success: false, error: `Campanha: ${created.error}` }, { status: 502 });
        templateId = created.templateId;
        templateNote = null;
      }
      campaignMessage = parsed.text;
      templateParams = parsed.params;
    } else if (fields.fields.campaign_enabled) {
      return NextResponse.json(
        { success: false, error: 'Escreva a mensagem do follow-up de campanha antes de ligar.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from('follow_up_settings')
      .upsert(
        {
          tenant_id: tenantId,
          ...fields.fields,
          conversation_message: conversationMessage || null,
          campaign_message: campaignMessage || null,
          template_id: templateId,
          template_params: templateParams,
          template_note: templateNote,
          updated_at: nowIso,
        },
        { onConflict: 'tenant_id' }
      )
      .select(FOLLOW_UP_SETTINGS_COLUMNS)
      .single();
    if (error) throw error;

    // Desligou um tipo: o que estava agendado dele não sai mais.
    for (const [origin, enabled] of [
      ['CONVERSATION', fields.fields.conversation_enabled],
      ['CAMPAIGN', fields.fields.campaign_enabled],
    ] as const) {
      if (enabled) continue;
      await supabaseAdmin
        .from('follow_ups')
        .update({ status: 'CANCELLED', error_message: 'Follow-up desligado.', updated_at: nowIso })
        .eq('tenant_id', tenantId)
        .eq('origin', origin)
        .eq('status', 'PENDING');
    }

    const campaignMessageStatus = await refreshFollowUpTemplateStatus(tenantId, templateId);
    logger.info('followup.settings_saved', {
      tenantId,
      conversation: fields.fields.conversation_enabled,
      campaign: fields.fields.campaign_enabled,
    });
    return NextResponse.json({
      success: true,
      settings: settingsFromRow(row as Record<string, unknown>),
      campaignMessageStatus,
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.follow-up.put', error);
  }
}

/** Pausa/retoma o follow-up de um contato: { leadId, paused }. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const body = (await req.json().catch(() => ({}))) as { leadId?: string; paused?: boolean };
    if (!body.leadId) return NextResponse.json({ success: false, error: 'Informe o contato.' }, { status: 400 });
    const paused = body.paused !== false;

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ follow_up_paused: paused, updated_at: new Date().toISOString() })
      .eq('id', body.leadId)
      .eq('tenant_id', tenantId)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Contato não encontrado.' }, { status: 404 });
    }

    if (paused) {
      await supabaseAdmin
        .from('follow_ups')
        .update({
          status: 'CANCELLED',
          error_message: 'Follow-up pausado para este contato.',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('lead_id', body.leadId)
        .eq('status', 'PENDING');
    }
    return NextResponse.json({ success: true, paused });
  } catch (error: unknown) {
    return internalErrorResponse('api.follow-up.patch', error);
  }
}

/** Cancela um follow-up agendado (?id=). */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Informe o follow-up.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .update({ status: 'CANCELLED', error_message: 'Cancelado manualmente.', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .eq('status', 'PENDING')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Esse follow-up já foi enviado ou cancelado.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.follow-up.delete', error);
  }
}
