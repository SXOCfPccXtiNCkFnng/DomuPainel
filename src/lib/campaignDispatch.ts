import { supabaseAdmin } from '@/lib/supabaseServer';
import { formatMetaError, sendMetaTemplate, type MetaCredentials } from '@/lib/metaClient';
import { assertMetaDispatchAllowed } from '@/lib/metaDispatchGuard';
import { logOpsAlert } from '@/lib/opsAlert';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import { notifyTenantAdmins } from '@/lib/notify';
import { GLOBAL_SYSTEM_TEMPLATES } from '@/lib/globalTemplates';
import { loadFollowUpSettings, scheduleCampaignFollowUp } from '@/lib/followUp';
import {
  buildBodyComponent,
  defaultParams,
  extractTemplateVariables,
  validateTemplateParams,
} from '@/lib/templateParams';

export type DispatchResult = {
  processed: number;
  sent: number;
  failed: number;
  skippedOptOut: number;
  skipped: boolean;
  reason?: string;
  campaignStatus: string;
};

/** Máximo de logs buscados por chamada; o resto fica para a próxima (cron/tela de progresso). */
const BATCH_LIMIT = 200;
/** Tempo máximo enviando numa chamada — tem que caber no maxDuration da rota (60s). */
const DEFAULT_TIME_BUDGET_MS = 40_000;
/**
 * Log em SENDING numa campanha sem atividade há esse tempo = o processo morreu
 * no meio do envio. Não reenviamos (a Meta pode ter aceitado), marcamos falha.
 */
const STALE_SENDING_MS = 5 * 60 * 1000;

/**
 * Envia logs PENDING de uma campanha via Meta e atualiza contadores.
 * Usa credenciais do tenant (fallback env). Respeita opt_in = false.
 *
 * Seguro para rodar em paralelo (cron + tela de progresso + criação): cada log
 * é reivindicado (PENDING → SENDING) antes do envio, então nunca sai duplicado.
 * Processa em lotes até `deadline`; o que sobrar continua PENDING e a campanha
 * fica RUNNING para a próxima chamada.
 */
export async function dispatchCampaignPending(
  campaignId: string,
  options?: { tenantId?: string; force?: boolean; deadline?: number }
): Promise<DispatchResult> {
  const deadline = options?.deadline ?? Date.now() + DEFAULT_TIME_BUDGET_MS;
  let query = supabaseAdmin
    .from('campaigns')
    // '*' (e não colunas fixas): inclui template_params sem quebrar se a migration não rodou.
    .select('*, hsm_templates(name, language, variables, body_text)')
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

  if (status === 'RUNNING') {
    const lastActivity = campaign.updated_at ? new Date(campaign.updated_at).getTime() : 0;
    if (Date.now() - lastActivity > STALE_SENDING_MS) {
      await failOrphanedSendingLogs(campaignId, campaign.tenant_id);
    }
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
    if (status === 'RUNNING') {
      // Vai para o fim da fila do cron, sem ocupar a vez das outras campanhas.
      await supabaseAdmin
        .from('campaigns')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .eq('tenant_id', campaign.tenant_id);
    }
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

  const templateObj = (campaign as any).hsm_templates;
  const templateMeta = templateObj?.name
    ? {
        name: templateObj.name,
        language:
          templateObj.name.startsWith('jaspers_')
            ? 'en_US'
            : templateObj.language || 'pt_BR',
        variables: templateObj.variables || [],
        bodyText: templateObj.body_text || '',
      }
    : await resolveTemplateDetails(campaign.template_id, campaign.tenant_id);

  const templateName = templateMeta?.name || null;
  const languageCode =
    templateName?.startsWith('jaspers_')
      ? 'en_US'
      : templateMeta?.language || 'pt_BR';

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

  // Valor de cada variável do template: o que foi escolhido na criação da
  // campanha (template_params). Campanha antiga sem isso usa a sugestão padrão
  // — e falha (sem enviar nada) se alguma variável exigir um texto.
  const templateVariables = extractTemplateVariables(templateMeta?.bodyText);
  const storedParams = (campaign as { template_params?: unknown }).template_params;
  const paramsCheck = validateTemplateParams(
    templateVariables,
    Array.isArray(storedParams) ? storedParams : defaultParams(templateVariables)
  );
  if (!paramsCheck.ok) {
    const reason = `Não foi possível montar a mensagem: ${paramsCheck.error} Crie a campanha de novo preenchendo as variáveis.`;
    await supabaseAdmin
      .from('campaign_logs')
      .update({ status: 'FAILED', error_message: reason })
      .eq('campaign_id', campaignId)
      .eq('tenant_id', campaign.tenant_id)
      .eq('status', 'PENDING');
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'FAILED', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .eq('tenant_id', campaign.tenant_id);
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skippedOptOut: 0,
      skipped: true,
      reason,
      campaignStatus: 'FAILED',
    };
  }
  const templateParams = paramsCheck.params;

  const { data: tenantRow } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', campaign.tenant_id)
    .maybeSingle();
  const companyName = tenantRow?.name || '';

  const { count: pendingTotal } = await supabaseAdmin
    .from('campaign_logs')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('tenant_id', campaign.tenant_id)
    .in('status', ['PENDING', 'SENDING']);

  // Antes de QUALQUER envio: número do próprio cliente, conferido na Meta e
  // igual ao do cadastro (requireVerifiedWhatsApp). As credenciais usadas no
  // loop são SÓ as devolvidas aqui.
  let credentials: MetaCredentials | null = null;
  if ((pendingTotal || 0) > 0) {
    const gate = await assertMetaDispatchAllowed(campaign.tenant_id, pendingTotal || 0, {
      excludeCampaignId: campaignId,
    });
    if (!gate.ok) {
      if (gate.transient) {
        // Meta instável: não falha a campanha, a próxima rodada tenta de novo.
        return {
          processed: 0,
          sent: 0,
          failed: 0,
          skippedOptOut: 0,
          skipped: true,
          reason: gate.error,
          campaignStatus: status,
        };
      }
      // Fecha os logs também — senão ficam "Na fila" para sempre numa campanha FAILED.
      await supabaseAdmin
        .from('campaign_logs')
        .update({ status: 'FAILED', error_message: gate.error })
        .eq('campaign_id', campaignId)
        .eq('tenant_id', campaign.tenant_id)
        .eq('status', 'PENDING');
      await supabaseAdmin
        .from('campaigns')
        .update({
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .eq('tenant_id', campaign.tenant_id);
      await logOpsAlert({
        source: 'campanha',
        message: `Disparo bloqueado (${campaign.name || campaignId}): ${gate.error}`,
        tenantId: campaign.tenant_id,
      });
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        skippedOptOut: 0,
        skipped: true,
        reason: gate.error,
        campaignStatus: 'FAILED',
      };
    }
    credentials = gate.credentials;
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
    .select('id, lead_id, leads(phone, name, opt_in, tenant_id)')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', campaign.tenant_id)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  // Sem credenciais verificadas não sai nada (ex.: fila apareceu depois da verificação).
  const logs = credentials ? pendingLogs || [] : [];
  // Lido uma vez por lote: cada envio com sucesso agenda o follow-up do contato.
  const followUpSettings = await loadFollowUpSettings(campaign.tenant_id);
  let sent = 0;
  let failed = 0;
  let skippedOptOut = 0;
  let processed = 0;

  for (const log of logs) {
    if (Date.now() > deadline) break;

    // Claim atômico do log: se outro worker já pegou, pula (evita mensagem duplicada).
    const { data: claimedLog, error: claimLogError } = await supabaseAdmin
      .from('campaign_logs')
      .update({ status: 'SENDING' })
      .eq('id', log.id)
      .eq('tenant_id', campaign.tenant_id)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();
    if (claimLogError) throw claimLogError;
    if (!claimedLog) continue;
    processed += 1;

    const lead = (log as any).leads;
    const phone = lead?.phone as string | undefined;
    const optIn = lead?.opt_in;
    const patch: Record<string, unknown> = {};

    if (!lead || lead.tenant_id !== campaign.tenant_id) {
      // Defesa extra: nunca enviar para contato de outra conta, mesmo com dado inconsistente.
      patch.status = 'FAILED';
      patch.error_message = 'Contato não pertence a esta conta.';
      failed += 1;
      await logOpsAlert({
        source: 'campanha.isolamento',
        message: `Log ${log.id} da campanha ${campaignId} aponta para contato de outra conta. Envio bloqueado.`,
        tenantId: campaign.tenant_id,
      });
    } else if (optIn === false) {
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
        let components: any[] | undefined = undefined;
        if (templateName === 'jaspers_market_order_confirmation_v1') {
          components = [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: lead?.name || 'Cliente' },
                { type: 'text', text: '#1001' },
                { type: 'text', text: 'Hoje' },
              ],
            },
          ];
        } else {
          // Cada variável recebe o valor escolhido na campanha (nome do
          // contato, nome da empresa ou texto fixo) — na ordem que a Meta espera.
          components = buildBodyComponent(templateParams, {
            contactName: lead?.name,
            companyName,
          });
        }

        const result = await sendMetaTemplate({
          to: phone,
          templateName,
          languageCode,
          credentials: credentials!,
          components,
        });
        if (result.success && result.messageId) {
          patch.status = 'SENT';
          patch.wamid = result.messageId;
          patch.sent_at = new Date().toISOString();
          patch.error_message = null;
          sent += 1;
          await scheduleCampaignFollowUp(followUpSettings, {
            tenantId: campaign.tenant_id,
            leadId: log.lead_id,
            campaignId,
            wamid: result.messageId,
          });
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

  const isTerminal = finalStatus === 'COMPLETED' || finalStatus === 'FAILED';
  // Condicional a RUNNING: só um worker fecha a campanha (sem notificação
  // duplicada) e ninguém "ressuscita" uma campanha que outro marcou FAILED.
  const { data: finalized } = await supabaseAdmin
    .from('campaigns')
    .update({
      status: finalStatus,
      sent_count: counts.sent + counts.delivered + counts.read,
      delivered_count: counts.delivered + counts.read,
      read_count: counts.read,
      failed_count: counts.failed,
      completed_at: isTerminal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('tenant_id', campaign.tenant_id)
    .eq('status', 'RUNNING')
    .select('id');
  const closedNow = isTerminal && (finalized?.length ?? 0) > 0;

  const sentTotal = counts.sent + counts.delivered + counts.read;
  if (closedNow && finalStatus === 'FAILED') {
    await logOpsAlert({
      source: 'campanha',
      message: `Campanha falhou (${campaign.name || campaignId}): ${counts.failed} envios com erro.`,
      tenantId: campaign.tenant_id,
    });
  }

  if (closedNow) {
    await notifyTenantAdmins(campaign.tenant_id, {
      title: finalStatus === 'COMPLETED' ? 'Campanha concluída' : 'Campanha falhou',
      message:
        finalStatus === 'COMPLETED'
          ? `"${campaign.name || 'Campanha'}" terminou: ${sentTotal} enviada(s), ${counts.failed} falha(s).`
          : `"${campaign.name || 'Campanha'}" falhou: ${counts.failed} envio(s) com erro.`,
      type: finalStatus === 'COMPLETED' ? 'SUCCESS' : 'ERROR',
    });
  }

  return {
    processed,
    sent,
    failed,
    skippedOptOut,
    skipped: false,
    campaignStatus: finalStatus,
  };
}

async function resolveTemplateDetails(
  templateId: string | null,
  tenantId: string
): Promise<{ name: string; language: string; variables?: string[]; bodyText?: string } | null> {
  if (!templateId) return null;
  const { data } = await supabaseAdmin
    .from('hsm_templates')
    .select('name, language, variables, body_text')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (data?.name) {
    return {
      name: data.name,
      language: data.language || (data.name.startsWith('jaspers_') ? 'en_US' : 'pt_BR'),
      variables: data.variables || [],
      bodyText: data.body_text || '',
    };
  }

  const globalTpl = GLOBAL_SYSTEM_TEMPLATES.find(
    (g) =>
      g.id === templateId ||
      g.name.toLowerCase() === templateId.toLowerCase()
  );
  if (globalTpl) {
    return {
      name: globalTpl.name,
      language: globalTpl.language || 'pt_BR',
      variables: globalTpl.variables || [],
      bodyText: globalTpl.body_text,
    };
  }

  return null;
}

export async function recountCampaignLogs(campaignId: string, tenantId: string) {
  // Contagem no banco (head + count): um select das linhas para em 1000 no
  // Supabase e fecharia campanhas grandes antes da hora.
  const countByStatus = async (statuses: string[]) => {
    const { count, error } = await supabaseAdmin
      .from('campaign_logs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId)
      .in('status', statuses);
    if (error) throw error;
    return count || 0;
  };

  // SENDING = reivindicado por um worker e ainda sem resposta da Meta: não terminou.
  const [pending, sent, delivered, read, failed] = await Promise.all([
    countByStatus(['PENDING', 'SENDING']),
    countByStatus(['SENT']),
    countByStatus(['DELIVERED']),
    countByStatus(['READ']),
    countByStatus(['FAILED']),
  ]);
  return { pending, sent, delivered, read, failed };
}

/** Logs presos em SENDING (processo morreu no meio): falha, nunca reenvio. */
async function failOrphanedSendingLogs(campaignId: string, tenantId: string) {
  await supabaseAdmin
    .from('campaign_logs')
    .update({
      status: 'FAILED',
      error_message:
        'Envio interrompido antes da confirmação da Meta. A mensagem pode ter sido entregue; não reenviamos para evitar duplicidade.',
    })
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId)
    .eq('status', 'SENDING');
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

/** RUNNING sem atividade há esse tempo = ninguém está enviando (timeout, tela fechada). */
const STALLED_RUNNING_MS = 2 * 60 * 1000;

/**
 * Processa campanhas SCHEDULED cujo horário já passou e retoma campanhas
 * RUNNING paradas (lote anterior estourou o tempo). Todas dividem um único
 * prazo, para caber no maxDuration da rota.
 */
export async function processDueScheduledCampaigns(options?: {
  tenantId?: string;
  limit?: number;
}): Promise<{ campaigns: number; results: DispatchResult[] }> {
  const deadline = Date.now() + DEFAULT_TIME_BUDGET_MS;
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
    // Sem tempo: não reivindica — continua SCHEDULED para a próxima rodada.
    if (Date.now() > deadline) break;
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
      deadline,
    });
    results.push(result);
  }

  let stalledQuery = supabaseAdmin
    .from('campaigns')
    .select('id, tenant_id')
    .eq('status', 'RUNNING')
    .lt('updated_at', new Date(Date.now() - STALLED_RUNNING_MS).toISOString())
    .order('updated_at', { ascending: true })
    .limit(options?.limit ?? 20);
  if (options?.tenantId) {
    stalledQuery = stalledQuery.eq('tenant_id', options.tenantId);
  }
  const { data: stalled, error: stalledError } = await stalledQuery;
  if (stalledError) throw stalledError;

  for (const camp of stalled || []) {
    if (Date.now() > deadline) break;
    const result = await dispatchCampaignPending(camp.id, {
      tenantId: camp.tenant_id,
      deadline,
    });
    results.push(result);
  }

  return { campaigns: (due || []).length + (stalled || []).length, results };
}
