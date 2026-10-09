import { NextRequest, NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import {
  getPlanDailyLimit,
  getPlanMonthlyLimit,
  isUnlimitedPlanLimit,
  normalizePlanTier,
} from '@/lib/planLimits';
import { dispatchCampaignPending } from '@/lib/campaignDispatch';
import { ensureTemplateIdForTenant } from '@/lib/globalTemplates';
import { assertMetaDispatchAllowed } from '@/lib/metaDispatchGuard';
import { chunk } from '@/lib/batch';
import { countDispatchesSince, startOfUtcDayIso, startOfUtcMonthIso } from '@/lib/dispatchUsage';
import {
  defaultParams,
  extractTemplateVariables,
  validateTemplateParams,
} from '@/lib/templateParams';

export const dynamic = 'force-dynamic';
/** O disparo imediato roda o primeiro lote (~40s) dentro do POST. */
export const maxDuration = 60;

const countSentInPeriod = countDispatchesSince;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
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
    return internalErrorResponse('api.campaigns', error);
  }
}

/**
 * POST — cria campanha + logs PENDING.
 * Imediato: processa envio agora. Agendado: fica SCHEDULED até /api/campaigns/run-due.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
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

    if (!isSubscriptionAllowedToDispatch(subscription?.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            subscription?.status === 'PENDING_PAYMENT'
              ? 'Conclua o pagamento da assinatura para disparar campanhas.'
              : 'Assinatura inativa ou vencida. Atualize o plano em Assinatura.',
        },
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

    // Em lotes: `.in()` com centenas de IDs estoura o tamanho da URL e cada
    // consulta para em 1000 linhas — campanhas grandes falhavam ou saíam pela metade.
    const uniqueLeadIds = [...new Set(leadIds.map((id: unknown) => String(id)))];
    const selectedLeads: { id: string; opt_in: boolean | null }[] = [];
    for (const ids of chunk(uniqueLeadIds)) {
      const { data, error: leadsError } = await supabaseAdmin
        .from('leads')
        .select('id, opt_in')
        .eq('tenant_id', tenantId)
        .in('id', ids);
      if (leadsError) throw leadsError;
      selectedLeads.push(...(data || []));
    }
    const eligibleCount = selectedLeads.filter((lead) => lead.opt_in !== false).length;
    if (eligibleCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Nenhum contato desta lista pode receber campanha. Quem pediu para parar (opt-out) fica de fora, como a Meta exige.',
        },
        { status: 400 }
      );
    }

    const metaGate = await assertMetaDispatchAllowed(tenantId, eligibleCount, {
      scheduled: Boolean(scheduledAt),
    });
    if (!metaGate.ok) {
      return NextResponse.json({ success: false, error: metaGate.error }, { status: 403 });
    }

    const isScheduled = Boolean(scheduledAt);
    const nowIso = new Date().toISOString();

    const resolvedTemplateId = await ensureTemplateIdForTenant(
      tenantId,
      templateId,
      templateName
    );

    if (!resolvedTemplateId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Por favor, selecione um modelo de mensagem aprovado para iniciar o disparo.',
        },
        { status: 400 }
      );
    }

    const { data: templateRow } = await supabaseAdmin
      .from('hsm_templates')
      .select('status, body_text')
      .eq('id', resolvedTemplateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (templateRow?.status !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error:
            'A Meta só deixa a empresa iniciar conversa com um template aprovado. Aguarde a aprovação em Templates antes de disparar.',
        },
        { status: 400 }
      );
    }

    // Valor de cada variável do template: vem do assistente; sem isso, usa a
    // sugestão padrão (nome do contato / empresa) — e recusa se alguma
    // variável precisar de um texto que não foi informado.
    const templateVariables = extractTemplateVariables(templateRow?.body_text);
    const paramsCheck = validateTemplateParams(
      templateVariables,
      Array.isArray(body.templateParams) ? body.templateParams : defaultParams(templateVariables)
    );
    if (!paramsCheck.ok) {
      return NextResponse.json({ success: false, error: paramsCheck.error }, { status: 400 });
    }
    const templateParams = paramsCheck.params;

    const campaignPayload: Record<string, unknown> = {
      tenant_id: tenantId,
      template_id: resolvedTemplateId,
      name,
      segment,
      status: isScheduled ? 'SCHEDULED' : 'RUNNING',
      scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : null,
      started_at: isScheduled ? null : nowIso,
      total_leads: selectedLeads.length,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      failed_count: 0,
      template_params: templateParams,
    };
    if (propertyId) {
      // Confirma que o imóvel é do próprio tenant antes de gravar a referência —
      // senão daria pra criar uma campanha apontando pro property_id de outra empresa.
      const { data: ownedProperty } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (ownedProperty) campaignPayload.property_id = propertyId;
    }

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

    // Migration de template_params ainda não rodou: só dá para seguir sem a
    // coluna se nenhuma variável usa texto fixo (o disparo recalcula o padrão).
    if (campError && String(campError.message || '').includes('template_params')) {
      if (templateParams.some((p) => p.source === 'fixed')) {
        throw new Error('Coluna campaigns.template_params ausente — rode a migration 20261008_campaign_template_params.');
      }
      delete campaignPayload.template_params;
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

    const leadList = selectedLeads;
    const logs = leadList.map((lead) => ({
      tenant_id: tenantId,
      campaign_id: campaign.id,
      lead_id: lead.id,
      status: lead.opt_in === false ? 'FAILED' : 'PENDING',
      error_message: lead.opt_in === false ? 'Opt-out: contato pediu para não receber.' : null,
    }));

    for (const part of chunk(logs, 1000)) {
      const { error: logError } = await supabaseAdmin.from('campaign_logs').insert(part);
      if (logError) {
        // Sem a fila de envio a campanha "concluiria" com zero envios: marca falha e avisa.
        console.error('[Campaign logs insert]', logError);
        await supabaseAdmin
          .from('campaigns')
          .update({ status: 'FAILED', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', campaign.id)
          .eq('tenant_id', tenantId);
        return NextResponse.json(
          { success: false, error: 'Não foi possível montar a fila de envio. Nenhuma mensagem foi enviada; tente de novo.' },
          { status: 500 }
        );
      }
    }

    let finalStatus = isScheduled ? 'SCHEDULED' : 'RUNNING';
    let sent = 0;
    let failed = 0;

    if (!isScheduled) {
      try {
        const result = await dispatchCampaignPending(campaign.id, { tenantId });
        finalStatus = result.campaignStatus;
        sent = result.sent;
        failed = result.failed;
      } catch (dispatchErr) {
        console.error('[Campaigns API Immediate Dispatch Error]', dispatchErr);
      }
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
    console.error('[Campaigns API POST Error]', error);
    let friendly = error.message || 'Erro ao registrar o disparo.';
    const lower = String(friendly).toLowerCase();
    if (lower.includes('uuid') || lower.includes('syntax') || lower.includes('invalid input')) {
      friendly = 'O modelo de mensagem selecionado precisa ser revalidado. Selecione o modelo novamente.';
    } else if (lower.includes('fkey') || lower.includes('foreign key')) {
      friendly = 'O modelo ou imóvel selecionado não foi encontrado na sua conta.';
    } else if (lower.includes('schema cache') || lower.includes('column') || lower.includes('relation')) {
      friendly = 'O banco de dados está sincronizando seus recursos. Tente novamente em instantes.';
    }
    return NextResponse.json({ success: false, error: friendly }, { status: 500 });
  }
}
