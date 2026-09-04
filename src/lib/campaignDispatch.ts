import { supabaseAdmin } from '@/lib/supabaseServer';
import { resolveMetaCredentials, sendMetaTemplate } from '@/lib/metaClient';
import { logOpsAlert } from '@/lib/opsAlert';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';

export type DispatchResult = {
  processed: number;
  sent: number;
  failed: number;
  skippedOptOut: number;
  skipped: boolean;
  reason?: string;
  campaignStatus: string;
};

function formatMetaError(err: unknown): string {
  if (!err) return 'Falha no envio via Meta Cloud API.';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Falha no envio via Meta Cloud API.';
  }
}

/**
 * Envia logs PENDING de uma campanha via Meta e atualiza contadores.
 * Usa credenciais do tenant (fallback env). Respeita opt_in = false.
 */
export async function dispatchCampaignPending(
  campaignId: string,
  options?: { tenantId?: string; force?: boolean }
): Promise<DispatchResult> {
  let query = supabaseAdmin
    .from('campaigns')
    .select('id, tenant_id, status, scheduled_at, template_id, name, hsm_templates(name)')
    .eq('id', campaignId);

  if (options?.tenantId) {
    query = query.eq('tenant_id', options.tenantId);
  }

  const { data: campaign, error } = await query.maybeSingle();
  if (error) throw error;
  if (!campaign) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skippedOptOut: 0,
      skipped: true,
      reason: 'Campanha não encontrada.',
      campaignStatus: 'MISSING',
    };
  }

  const status = String(campaign.status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'FAILED') {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skippedOptOut: 0,
      skipped: true,
      reason: 'Campanha já finalizada.',
      campaignStatus: status,
    };
  }

  if (status === 'SCHEDULED' && !options?.force) {
    const when = campaign.scheduled_at ? new Date(campaign.scheduled_at).getTime() : 0;
    if (when > Date.now()) {
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        skippedOptOut: 0,
        skipped: true,
        reason: 'Ainda não chegou o horário agendado.',
        campaignStatus: 'SCHEDULED',
      };
    }
  }

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', campaign.tenant_id)
    .maybeSingle();

  if (!isSubscriptionAllowedToDispatch(subscription?.status)) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skippedOptOut: 0,
      skipped: true,
      reason: 'Assinatura inativa ou vencida — disparo bloqueado até regularizar o pagamento.',
      campaignStatus: status,
    };
  }

  const templateName =
    (campaign as any).hsm_templates?.name ||
    (await resolveTemplateName(campaign.template_id, campaign.tenant_id));

  if (!templateName) {
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    await logOpsAlert({
      source: 'campanha',
      message: `Template não encontrado (${campaign.name || campaignId}).`,
      tenantId: campaign.tenant_id,
    });

    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skippedOptOut: 0,
      skipped: true,
      reason: 'Template não encontrado.',
      campaignStatus: 'FAILED',
    };
  }

  let credentials;
  try {
    credentials = await resolveMetaCredentials(campaign.tenant_id);
  } catch (err: any) {
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    await logOpsAlert({
      source: 'campanha',
      message: err?.message || 'Credenciais Meta ausentes.',
      tenantId: campaign.tenant_id,
    });

    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skippedOptOut: 0,
      skipped: true,
      reason: err?.message || 'Credenciais Meta ausentes.',
      campaignStatus: 'FAILED',
    };
  }

  const nowIso = new Date().toISOString();
  // Claim atômico: só um worker passa SCHEDULED/DRAFT → RUNNING.
  if (status === 'SCHEDULED' || status === 'DRAFT') {
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'RUNNING',
        started_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', campaignId)
      .eq('tenant_id', campaign.tenant_id)
      .eq('status', status)
      .select('id')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) {
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        skippedOptOut: 0,
        skipped: true,
        reason: 'Campanha já reivindicada por outro processo.',
        campaignStatus: 'RUNNING',
      };
    }
  } else if (status === 'RUNNING') {
    await supabaseAdmin
      .from('campaigns')
      .update({ updated_at: nowIso })
      .eq('id', campaignId)
      .eq('tenant_id', campaign.tenant_id)
      .eq('status', 'RUNNING');
  }

  const { data: pendingLogs } = await supabaseAdmin
    .from('campaign_logs')
    .select('id, lead_id, leads(phone, name, opt_in)')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', campaign.tenant_id)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });

  const logs = pendingLogs || [];
  let sent = 0;
  let failed = 0;
  let skippedOptOut = 0;

  for (const log of logs) {
    const lead = (log as any).leads;
    const phone = lead?.phone as string | undefined;
    const optIn = lead?.opt_in;
    const patch: Record<string, unknown> = {};

    if (optIn === false) {
      patch.status = 'FAILED';
      patch.error_message = 'Opt-out: contato pediu para não receber.';
      skippedOptOut += 1;
      failed += 1;
    } else if (!phone) {
      patch.status = 'FAILED';
      patch.error_message = 'Lead sem telefone.';
      failed += 1;
    } else {
      try {
        const result = await sendMetaTemplate({
          to: phone,
          templateName,
          languageCode: 'pt_BR',
          credentials,
        });
        if (result.success && result.messageId) {
          patch.status = 'SENT';
          patch.wamid = result.messageId;
          patch.sent_at = new Date().toISOString();
          patch.error_message = null;
          sent += 1;
        } else {
          patch.status = 'FAILED';
          patch.error_message = formatMetaError(result.error);
          failed += 1;
        }
      } catch (err: any) {
        patch.status = 'FAILED';
        patch.error_message = err?.message || 'Erro ao enviar via Meta Cloud API.';
        failed += 1;
      }
    }

    await supabaseAdmin
      .from('campaign_logs')
      .update(patch)
      .eq('id', log.id)
      .eq('tenant_id', campaign.tenant_id);
  }

  const counts = await recountCampaignLogs(campaignId, campaign.tenant_id);
  const stillPending = counts.pending;
  const finalStatus =
    stillPending > 0
      ? 'RUNNING'
      : counts.failed > 0 && counts.sent === 0 && counts.delivered === 0 && counts.read === 0
        ? 'FAILED'
        : 'COMPLETED';

  await supabaseAdmin
    .from('campaigns')
    .update({
      status: finalStatus,
      sent_count: counts.sent + counts.delivered + counts.read,
      delivered_count: counts.delivered + counts.read,
      read_count: counts.read,
      failed_count: counts.failed,
      completed_at: stillPending > 0 ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('tenant_id', campaign.tenant_id);

  if (finalStatus === 'FAILED') {
    await logOpsAlert({
      source: 'campanha',
      message: `Campanha falhou (${campaign.name || campaignId}): ${failed} envios com erro.`,
      tenantId: campaign.tenant_id,
    });
  }

  return {
    processed: logs.length,
    sent,
    failed,
    skippedOptOut,
    skipped: false,
    campaignStatus: finalStatus,
  };
}

async function resolveTemplateName(
  templateId: string | null,
  tenantId: string
): Promise<string | null> {
  if (!templateId) return null;
  const { data } = await supabaseAdmin
    .from('hsm_templates')
    .select('name')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data?.name || null;
}

export async function recountCampaignLogs(campaignId: string, tenantId: string) {
  const { data: rows } = await supabaseAdmin
    .from('campaign_logs')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId);

  const counts = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const row of rows || []) {
    const s = String(row.status || '').toUpperCase();
    if (s === 'PENDING') counts.pending += 1;
    else if (s === 'SENT') counts.sent += 1;
    else if (s === 'DELIVERED') counts.delivered += 1;
    else if (s === 'READ') counts.read += 1;
    else if (s === 'FAILED') counts.failed += 1;
  }
  return counts;
}

/**
 * Tenta reivindicar uma campanha SCHEDULED vencida (SCHEDULED → RUNNING).
 * Retorna false se outro worker já pegou.
 */
export async function claimDueScheduledCampaign(
  campaignId: string,
  tenantId: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update({
      status: 'RUNNING',
      started_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .eq('status', 'SCHEDULED')
    .lte('scheduled_at', nowIso)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

/** Processa campanhas SCHEDULED cujo horário já passou. */
export async function processDueScheduledCampaigns(options?: {
  tenantId?: string;
  limit?: number;
}): Promise<{ campaigns: number; results: DispatchResult[] }> {
  const nowIso = new Date().toISOString();
  let query = supabaseAdmin
    .from('campaigns')
    .select('id, tenant_id')
    .eq('status', 'SCHEDULED')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(options?.limit ?? 20);

  if (options?.tenantId) {
    query = query.eq('tenant_id', options.tenantId);
  }

  const { data: due, error } = await query;
  if (error) throw error;

  const results: DispatchResult[] = [];
  for (const camp of due || []) {
    const claimed = await claimDueScheduledCampaign(camp.id, camp.tenant_id);
    if (!claimed) {
      results.push({
        processed: 0,
        sent: 0,
        failed: 0,
        skippedOptOut: 0,
        skipped: true,
        reason: 'Campanha já reivindicada por outro processo.',
        campaignStatus: 'RUNNING',
      });
      continue;
    }

    // Já está RUNNING — force evita revalidar scheduled_at; claim já foi feito.
    const result = await dispatchCampaignPending(camp.id, {
      tenantId: camp.tenant_id,
      force: true,
    });
    results.push(result);
  }

  return { campaigns: (due || []).length, results };
}
