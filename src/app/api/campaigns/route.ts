import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import {
  getPlanDailyLimit,
  getPlanMonthlyLimit,
  isUnlimitedPlanLimit,
  normalizePlanTier,
} from '@/lib/planLimits';
import { dispatchCampaignPending } from '@/lib/campaignDispatch';

export const dynamic = 'force-dynamic';

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfUtcMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countSentInPeriod(tenantId: string, sinceIso: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('sent_count')
    .eq('tenant_id', tenantId)
    .gte('created_at', sinceIso);

  return (data || []).reduce((sum, row: any) => sum + Number(row.sent_count || 0), 0);
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, hsm_templates(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const propertyIds = Array.from(
      new Set((data || []).map((c: any) => c.property_id).filter(Boolean))
    );
    let propertyMap: Record<string, { title: string; code: string }> = {};
    if (propertyIds.length > 0) {
      const { data: props } = await supabaseAdmin
        .from('properties')
        .select('id, title, code')
        .eq('tenant_id', tenantId)
        .in('id', propertyIds);
      (props || []).forEach((p: any) => {
        propertyMap[p.id] = { title: p.title, code: p.code };
      });
    }

    const campaigns = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      segment: c.segment,
      status: c.status,
      scheduledAt: c.scheduled_at,
      createdAt: c.created_at,
      totalLeads: c.total_leads || 0,
      sentCount: c.sent_count || 0,
      deliveredCount: c.delivered_count || 0,
      readCount: c.read_count || 0,
      failedCount: c.failed_count || 0,
      templateName: c.hsm_templates?.name || 'Modelo',
      propertyId: c.property_id || null,
      propertyTitle: c.property_id ? propertyMap[c.property_id]?.title || null : null,
      propertyCode: c.property_id ? propertyMap[c.property_id]?.code || null : null,
    }));

    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    console.error('[Campaigns GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST — cria campanha + logs PENDING.
 * Imediato: processa envio agora. Agendado: fica SCHEDULED até /api/campaigns/run-due.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const {
      name,
      templateName,
      templateId,
      leadIds,
      propertyId,
      scheduledAt,
      segment = 'geral',
    } = body;

    if (!name || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nome da campanha e leadIds são obrigatórios.' },
        { status: 400 }
      );
    }

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_tier, monthly_message_limit, status')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (subscription?.status && !['ACTIVE', 'TRIAL'].includes(subscription.status)) {
      return NextResponse.json(
        { success: false, error: 'Assinatura inativa. Atualize o plano para disparar.' },
        { status: 402 }
      );
    }

    const planTier = normalizePlanTier(subscription?.plan_tier);
    const fromSub = Number(subscription?.monthly_message_limit);
    const monthlyLimit = fromSub > 0 ? fromSub : getPlanMonthlyLimit(planTier);
    const dailyLimit = getPlanDailyLimit(planTier);
    const batchSize = leadIds.length;

    if (!isUnlimitedPlanLimit(monthlyLimit)) {
      const usedMonth = await countSentInPeriod(tenantId, startOfUtcMonthIso());
      if (usedMonth + batchSize > monthlyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Limite mensal do plano (${monthlyLimit} disparos) seria excedido. Já usados: ${usedMonth}.`,
          },
          { status: 429 }
        );
      }
    }

    if (dailyLimit != null) {
      const usedDay = await countSentInPeriod(tenantId, startOfUtcDayIso());
      if (usedDay + batchSize > dailyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Limite diário do plano (${dailyLimit} disparos) seria excedido. Já usados hoje: ${usedDay}.`,
          },
          { status: 429 }
        );
      }
    }

    const isScheduled = Boolean(scheduledAt);
    const nowIso = new Date().toISOString();

    let resolvedTemplateId = templateId || null;
    if (!resolvedTemplateId && templateName) {
      const { data: tpl } = await supabaseAdmin
        .from('hsm_templates')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('name', templateName)
        .limit(1)
        .maybeSingle();
      resolvedTemplateId = tpl?.id || null;
    }

    const campaignPayload: Record<string, unknown> = {
      tenant_id: tenantId,
      template_id: resolvedTemplateId,
      name,
      segment,
      status: isScheduled ? 'SCHEDULED' : 'RUNNING',
      scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : null,
      started_at: isScheduled ? null : nowIso,
      total_leads: leadIds.length,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      failed_count: 0,
    };
    if (propertyId) campaignPayload.property_id = propertyId;

    let { data: campaign, error: campError } = await supabaseAdmin
      .from('campaigns')
      .insert(campaignPayload)
      .select('*')
      .single();

    if (campError && propertyId) {
      delete campaignPayload.property_id;
      const retry = await supabaseAdmin
        .from('campaigns')
        .insert(campaignPayload)
        .select('*')
        .single();
      campaign = retry.data;
      campError = retry.error;
    }

    if (campError) throw campError;
    if (!campaign) throw new Error('Campanha não criada.');

    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('id, phone, name')
      .eq('tenant_id', tenantId)
      .in('id', leadIds);

    const leadList = leads || [];
    const logs = leadList.map((lead) => ({
      tenant_id: tenantId,
      campaign_id: campaign.id,
      lead_id: lead.id,
      status: 'PENDING',
    }));

    if (logs.length > 0) {
      const { error: logError } = await supabaseAdmin.from('campaign_logs').insert(logs);
      if (logError) console.error('[Campaign logs insert]', logError);
    }

    let finalStatus = isScheduled ? 'SCHEDULED' : 'RUNNING';
    let sent = 0;
    let failed = 0;

    if (!isScheduled) {
      const result = await dispatchCampaignPending(campaign.id, { tenantId });
      finalStatus = result.campaignStatus;
      sent = result.sent;
      failed = result.failed;
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: finalStatus,
        sentCount: sent,
        deliveredCount: 0,
        readCount: 0,
        failedCount: failed,
        totalLeads: leadList.length,
        scheduledAt: campaign.scheduled_at,
        propertyId: propertyId || null,
        templateName: templateName || null,
      },
    });
  } catch (error: any) {
    console.error('[Campaigns POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
