/**
 * Follow-up automático: agenda depois de cada mensagem da empresa, cancela
 * quando o contato responde e envia os vencidos (cron /api/follow-up/run-due).
 *
 * CONVERSA: texto livre, só dentro da janela de 24h do WhatsApp, e só depois
 *           de passar pelas proteções (pausa, status, palavras e IA).
 * CAMPANHA: template aprovado pela Meta para quem recebeu campanha e não respondeu.
 *
 * Agendar/cancelar é best-effort: falha nunca derruba a campanha nem o webhook.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import {
  createMetaMessageTemplate,
  fetchMetaTemplateStatus,
  formatMetaError,
  sendMetaTemplate,
  sendMetaText,
  type MetaCredentials,
} from '@/lib/metaClient';
import { assertMetaDispatchAllowed } from '@/lib/metaDispatchGuard';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import {
  buildBodyComponent,
  extractTemplateVariables,
  renderWithParams,
  resolveParamValues,
  validateTemplateParams,
  type TemplateParam,
} from '@/lib/templateParams';
import {
  conversationSchedule,
  DEFAULT_FOLLOW_UP_SETTINGS,
  FOLLOW_UP_TEMPLATE_PREFIX,
  isFollowUpCompatibleTemplate,
  isOriginEnabled,
  nextAllowedSendTime,
  renderFollowUpText,
  WINDOW_MS,
  WINDOW_SAFETY_MS,
  type FollowUpOrigin,
  type FollowUpSettings,
  type FollowUpSkipCode,
} from '@/lib/followUpRules';
import {
  checkContextByKeywords,
  checkContextWithAI,
  type ConversationMessage,
} from '@/lib/followUpContext';

const HOUR_MS = 60 * 60 * 1000;
/** Resposta até 7 dias depois do follow-up conta como "respondeu depois". */
const REPLY_ATTRIBUTION_MS = 7 * 24 * HOUR_MS;
/** Bloqueio passageiro (Meta/IA fora do ar, mensagem em análise): tenta de novo depois disso. */
const RETRY_MS = 30 * 60 * 1000;
/** Mensagens lidas para a checagem de contexto. */
const CONTEXT_MESSAGES = 15;

export const FOLLOW_UP_SETTINGS_COLUMNS =
  'conversation_enabled, conversation_message, conversation_delay_hours, campaign_enabled, campaign_message, campaign_delay_hours, template_id, template_params, template_note, ai_check_enabled, excluded_statuses, window_start_hour, window_end_hour, skip_weekends';

export function settingsFromRow(row: Record<string, unknown> | null | undefined): FollowUpSettings {
  const d = DEFAULT_FOLLOW_UP_SETTINGS;
  if (!row) return { ...d };
  return {
    conversation_enabled: Boolean(row.conversation_enabled),
    conversation_message: String(row.conversation_message || ''),
    conversation_delay_hours: Number(row.conversation_delay_hours) || d.conversation_delay_hours,
    campaign_enabled: Boolean(row.campaign_enabled),
    campaign_message: String(row.campaign_message || ''),
    campaign_delay_hours: Number(row.campaign_delay_hours) || d.campaign_delay_hours,
    template_id: (row.template_id as string | null) || null,
    template_params: Array.isArray(row.template_params) ? (row.template_params as TemplateParam[]) : [],
    template_note: (row.template_note as string | null) || null,
    ai_check_enabled: row.ai_check_enabled !== false,
    excluded_statuses: Array.isArray(row.excluded_statuses) ? (row.excluded_statuses as string[]) : d.excluded_statuses,
    window_start_hour: Number(row.window_start_hour ?? d.window_start_hour),
    window_end_hour: Number(row.window_end_hour ?? d.window_end_hour),
    skip_weekends: Boolean(row.skip_weekends),
  };
}

export async function loadFollowUpSettings(tenantId: string): Promise<FollowUpSettings> {
  const { data, error } = await supabaseAdmin
    .from('follow_up_settings')
    .select(FOLLOW_UP_SETTINGS_COLUMNS)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  // Tabela ainda não migrada = follow-up desligado.
  if (error) return { ...DEFAULT_FOLLOW_UP_SETTINGS };
  return settingsFromRow(data as Record<string, unknown> | null);
}

/** Um follow-up em aberto por contato: se já existe, reinicia o relógio; senão cria. */
async function upsertOpenFollowUp(
  tenantId: string,
  leadId: string,
  fields: {
    origin: FollowUpOrigin;
    campaign_id: string | null;
    origin_wamid: string | null;
    due_at: string;
    deadline_at: string | null;
  }
): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch = { ...fields, error_message: null, skip_code: null, updated_at: nowIso };
  const { data: restarted, error: updateError } = await supabaseAdmin
    .from('follow_ups')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .eq('status', 'PENDING')
    .select('id');
  if (updateError) throw updateError;
  if (restarted && restarted.length > 0) return;

  const { error: insertError } = await supabaseAdmin
    .from('follow_ups')
    .insert({ tenant_id: tenantId, lead_id: leadId, status: 'PENDING', ...patch });
  // 23505: outro processo criou (ou está enviando) o follow-up deste contato.
  if (insertError && insertError.code !== '23505') throw insertError;
}

/**
 * A empresa mandou mensagem numa conversa (pelo celular ou pelo painel).
 * Agenda o follow-up de conversa se a janela de 24h estiver aberta.
 */
export async function scheduleConversationFollowUp(
  settings: FollowUpSettings,
  input: { tenantId: string; leadId: string; wamid?: string | null; sentAt?: Date }
): Promise<void> {
  if (!isOriginEnabled(settings, 'CONVERSATION')) return;
  try {
    const { data: lastInbound } = await supabaseAdmin
      .from('chat_messages')
      .select('created_at')
      .eq('tenant_id', input.tenantId)
      .eq('lead_id', input.leadId)
      .eq('direction', 'INBOUND')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const schedule = conversationSchedule(
      input.sentAt || new Date(),
      lastInbound ? new Date(lastInbound.created_at) : null,
      settings.conversation_delay_hours
    );
    if (!schedule) return;

    await upsertOpenFollowUp(input.tenantId, input.leadId, {
      origin: 'CONVERSATION',
      campaign_id: null,
      origin_wamid: input.wamid || null,
      due_at: schedule.dueAt.toISOString(),
      deadline_at: schedule.deadlineAt.toISOString(),
    });
  } catch (err) {
    logger.error('followup.schedule_conversation_failed', {
      tenantId: input.tenantId,
      leadId: input.leadId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Contato recebeu campanha: agenda o follow-up de campanha (se ligado). */
export async function scheduleCampaignFollowUp(
  settings: FollowUpSettings,
  input: { tenantId: string; leadId: string; campaignId: string; wamid?: string | null }
): Promise<void> {
  if (!isOriginEnabled(settings, 'CAMPAIGN')) return;
  try {
    await upsertOpenFollowUp(input.tenantId, input.leadId, {
      origin: 'CAMPAIGN',
      campaign_id: input.campaignId,
      origin_wamid: input.wamid || null,
      due_at: new Date(Date.now() + settings.campaign_delay_hours * HOUR_MS).toISOString(),
      deadline_at: null,
    });
  } catch (err) {
    logger.error('followup.schedule_campaign_failed', {
      tenantId: input.tenantId,
      leadId: input.leadId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Contato respondeu: cancela o que estava agendado e marca o follow-up recente como respondido. */
export async function handleFollowUpReply(tenantId: string, leadId: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('follow_ups')
      .update({ status: 'REPLIED', updated_at: nowIso })
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .eq('status', 'PENDING');

    await supabaseAdmin
      .from('follow_ups')
      .update({ replied_at: nowIso, updated_at: nowIso })
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .eq('status', 'SENT')
      .is('replied_at', null)
      .gte('sent_at', new Date(Date.now() - REPLY_ATTRIBUTION_MS).toISOString());
  } catch (err) {
    logger.error('followup.reply_update_failed', {
      tenantId,
      leadId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export type FollowUpTemplateStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

const REJECTION_REASONS: Record<string, string> = {
  INVALID_FORMAT: 'formato inválido',
  PROMOTIONAL: 'conteúdo considerado promocional demais',
  ABUSIVE_CONTENT: 'conteúdo considerado abusivo',
  INCORRECT_CATEGORY: 'categoria incorreta',
  TAG_CONTENT_MISMATCH: 'o texto não combina com a categoria',
  SCAM: 'conteúdo parecido com golpe',
};

/**
 * Cria na Meta o template do follow-up de campanha a partir do texto do
 * cliente. Nome único a cada versão: editar um aprovado volta para análise e
 * a Meta não deixa reaproveitar nome recém-apagado.
 */
export async function createFollowUpTemplate(
  tenantId: string,
  text: string
): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const name = `${FOLLOW_UP_TEMPLATE_PREFIX}${Date.now().toString(36)}`;
  const meta = await createMetaMessageTemplate({
    tenantId,
    name,
    category: 'MARKETING',
    language: 'pt_BR',
    bodyText: text,
  });
  if (!meta.success) {
    return { ok: false, error: meta.error || 'A Meta não aceitou a mensagem. Tente ajustar o texto.' };
  }

  const status = String(meta.status || 'PENDING').toUpperCase();
  const { data, error } = await supabaseAdmin
    .from('hsm_templates')
    .insert({
      tenant_id: tenantId,
      name,
      category: 'MARKETING',
      language: 'pt_BR',
      status: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING',
      meta_template_id: meta.metaTemplateId || null,
      header_type: 'NONE',
      body_text: text,
      variables: meta.variables || extractTemplateVariables(text),
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Não foi possível salvar a mensagem.' };
  return { ok: true, templateId: data.id };
}

/** Consulta a Meta se o template ainda está em análise e grava o resultado. */
export async function refreshFollowUpTemplateStatus(
  tenantId: string,
  templateId: string | null
): Promise<FollowUpTemplateStatus> {
  if (!templateId) return 'NONE';
  const { data: tpl } = await supabaseAdmin
    .from('hsm_templates')
    .select('status, meta_template_id')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!tpl) return 'NONE';
  const current = (tpl.status === 'APPROVED' || tpl.status === 'REJECTED' ? tpl.status : 'PENDING') as FollowUpTemplateStatus;
  if (current !== 'PENDING' || !tpl.meta_template_id) return current;

  const meta = await fetchMetaTemplateStatus(tenantId, tpl.meta_template_id);
  if (!meta.ok || meta.status === 'PENDING') return 'PENDING';

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from('hsm_templates')
    .update({ status: meta.status, updated_at: nowIso })
    .eq('id', templateId)
    .eq('tenant_id', tenantId);
  await supabaseAdmin
    .from('follow_up_settings')
    .update({
      template_note:
        meta.status === 'REJECTED'
          ? `A Meta reprovou a mensagem${meta.reason ? ` (${REJECTION_REASONS[meta.reason] || meta.reason})` : ''}. Ajuste o texto e salve de novo.`
          : null,
      updated_at: nowIso,
    })
    .eq('tenant_id', tenantId)
    .eq('template_id', templateId);
  return meta.status;
}

type TenantContext = {
  settings: FollowUpSettings;
  companyName: string;
  /** Bloqueio que vale para a conta inteira (assinatura, número na Meta). */
  blocked: { reason: string; transient: boolean } | null;
  credentials?: MetaCredentials;
  campaignTemplate?:
    | { ok: true; name: string; language: string; bodyText: string; variables: string[]; params: TemplateParam[] }
    | { ok: false; reason: string; transient: boolean };
};

async function loadTenantContext(tenantId: string): Promise<TenantContext> {
  const settings = await loadFollowUpSettings(tenantId);
  const [{ data: tenant }, { data: sub }] = await Promise.all([
    supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  const ctx: TenantContext = { settings, companyName: tenant?.name || '', blocked: null };

  // Follow-up não conta no limite de disparos do plano, mas exige assinatura ativa.
  if (!isSubscriptionAllowedToDispatch(sub?.status)) {
    ctx.blocked = { reason: 'Assinatura inativa ou vencida.', transient: false };
    return ctx;
  }
  const gate = await assertMetaDispatchAllowed(tenantId, 1);
  if (!gate.ok) {
    ctx.blocked = { reason: gate.error, transient: gate.transient };
    return ctx;
  }
  ctx.credentials = gate.credentials;
  return ctx;
}

async function loadCampaignTemplate(tenantId: string, settings: FollowUpSettings): Promise<TenantContext['campaignTemplate']> {
  if (!settings.template_id) return { ok: false, reason: 'Escreva a mensagem do follow-up de campanha.', transient: false };
  const status = await refreshFollowUpTemplateStatus(tenantId, settings.template_id);
  if (status === 'PENDING') return { ok: false, reason: 'Mensagem em análise na Meta. Sai assim que for aprovada.', transient: true };
  if (status !== 'APPROVED') {
    return { ok: false, reason: 'A Meta reprovou a mensagem do follow-up de campanha. Ajuste o texto.', transient: false };
  }
  const { data: tpl } = await supabaseAdmin
    .from('hsm_templates')
    .select('name, language, body_text, status, header_type')
    .eq('id', settings.template_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!tpl || !isFollowUpCompatibleTemplate(tpl)) {
    return { ok: false, reason: 'A mensagem de campanha não está disponível. Salve o texto de novo.', transient: false };
  }
  const variables = extractTemplateVariables(tpl.body_text);
  const params = validateTemplateParams(variables, settings.template_params);
  if (!params.ok) return { ok: false, reason: 'A mensagem de campanha mudou. Salve o texto de novo.', transient: false };
  return {
    ok: true,
    name: tpl.name,
    language: tpl.language || 'pt_BR',
    bodyText: tpl.body_text || '',
    variables,
    params: params.params,
  };
}

export type FollowUpRunResult = {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
  replied: number;
  rescheduled: number;
};

type DueRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  origin: FollowUpOrigin;
  created_at: string;
  leads: { name?: string | null; phone?: string | null; opt_in?: boolean | null; tenant_id?: string; status?: string | null; follow_up_paused?: boolean | null } | null;
};

/** Envia os follow-ups vencidos. Seguro para rodar em paralelo (claim atômico por linha). */
export async function processDueFollowUps(options?: {
  limit?: number;
  deadlineMs?: number;
}): Promise<FollowUpRunResult> {
  const result: FollowUpRunResult = { checked: 0, sent: 0, failed: 0, skipped: 0, replied: 0, rescheduled: 0 };
  const runDeadline = Date.now() + (options?.deadlineMs ?? 45_000);

  const { data: due, error } = await supabaseAdmin
    .from('follow_ups')
    .select('id, tenant_id, lead_id, origin, created_at, leads(name, phone, opt_in, tenant_id, status, follow_up_paused)')
    .eq('status', 'PENDING')
    .lte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(options?.limit ?? 50);
  if (error) {
    if (error.code === '42P01') return result; // tabela ainda não migrada
    throw error;
  }

  const contexts = new Map<string, TenantContext>();

  const update = async (row: DueRow, patch: Record<string, unknown>) => {
    await supabaseAdmin
      .from('follow_ups')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id);
  };
  const skip = async (row: DueRow, code: FollowUpSkipCode, message: string) => {
    await update(row, { status: 'SKIPPED', skip_code: code, error_message: message });
    result.skipped += 1;
  };
  /** Tenta de novo mais tarde — se ainda couber antes da janela fechar. */
  const retryLater = async (row: DueRow, reason: string, windowDeadline: number | null) => {
    const next = Date.now() + RETRY_MS;
    if (windowDeadline != null && next >= windowDeadline) {
      await skip(row, 'WINDOW_CLOSED', `${reason} A conversa do WhatsApp fecharia antes, então não enviamos.`);
      return;
    }
    await update(row, { status: 'PENDING', due_at: new Date(next).toISOString(), error_message: reason });
    result.rescheduled += 1;
  };

  for (const row of (due || []) as unknown as DueRow[]) {
    if (Date.now() > runDeadline) break;
    result.checked += 1;

    let ctx = contexts.get(row.tenant_id);
    if (!ctx) {
      ctx = await loadTenantContext(row.tenant_id);
      contexts.set(row.tenant_id, ctx);
    }
    const { settings } = ctx;
    const isConversation = row.origin === 'CONVERSATION';

    if (!isOriginEnabled(settings, row.origin)) {
      await update(row, {
        status: 'CANCELLED',
        error_message: `Follow-up de ${isConversation ? 'conversa' : 'campanha'} desligado.`,
      });
      result.skipped += 1;
      continue;
    }

    // Histórico recente da conversa (mais antiga → mais recente).
    const { data: history } = await supabaseAdmin
      .from('chat_messages')
      .select('direction, body, created_at')
      .eq('tenant_id', row.tenant_id)
      .eq('lead_id', row.lead_id)
      .order('created_at', { ascending: false })
      .limit(CONTEXT_MESSAGES);
    const messages = ((history || []) as ConversationMessage[]).slice().reverse();
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'INBOUND');
    const lastMessage = messages[messages.length - 1];

    // Contato respondeu e o cancelamento pelo webhook se perdeu. Conversa: a
    // última mensagem é dele. Campanha: escreveu depois do agendamento.
    const replied = isConversation
      ? lastMessage?.direction === 'INBOUND'
      : Boolean(lastInbound && new Date(lastInbound.created_at) > new Date(row.created_at));
    if (replied) {
      await update(row, { status: 'REPLIED' });
      result.replied += 1;
      continue;
    }

    // Conversa: a janela de 24h é contada da última mensagem DO CONTATO.
    let windowDeadline: number | null = null;
    if (isConversation) {
      windowDeadline = lastInbound ? new Date(lastInbound.created_at).getTime() + WINDOW_MS - WINDOW_SAFETY_MS : 0;
      if (Date.now() >= windowDeadline) {
        await skip(row, 'WINDOW_CLOSED', 'A conversa do WhatsApp fechou (24h sem mensagem do contato).');
        continue;
      }
    }

    // Fora do horário de envio: empurra o prazo (conversa: só se ainda couber na janela).
    const now = new Date();
    const allowedAt = nextAllowedSendTime(now, settings);
    if (allowedAt.getTime() > now.getTime()) {
      if (windowDeadline != null && allowedAt.getTime() >= windowDeadline) {
        await skip(row, 'WINDOW_CLOSED', 'Fora do horário de envio, e a conversa do WhatsApp fecharia antes do próximo horário.');
        continue;
      }
      await supabaseAdmin
        .from('follow_ups')
        .update({ due_at: allowedAt.toISOString(), updated_at: now.toISOString() })
        .eq('id', row.id)
        .eq('tenant_id', row.tenant_id)
        .eq('status', 'PENDING');
      result.rescheduled += 1;
      continue;
    }

    // Claim atômico: com dois crons ao mesmo tempo, só um envia.
    const { data: claimed } = await supabaseAdmin
      .from('follow_ups')
      .update({ status: 'PROCESSING', updated_at: now.toISOString() })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const lead = row.leads;
    if (!lead || lead.tenant_id !== row.tenant_id || !lead.phone) {
      await skip(row, 'OTHER', 'Contato não encontrado.');
      continue;
    }
    if (lead.follow_up_paused) {
      await skip(row, 'PAUSED', 'Follow-up pausado para este contato.');
      continue;
    }
    if (lead.opt_in === false) {
      await skip(row, 'OPT_OUT', 'O contato pediu para não receber mensagens.');
      continue;
    }
    if (lead.status && settings.excluded_statuses.includes(lead.status)) {
      await skip(row, 'STATUS', `O contato está com status "${lead.status}", que não recebe follow-up.`);
      continue;
    }

    if (ctx.blocked) {
      if (ctx.blocked.transient) await retryLater(row, ctx.blocked.reason, windowDeadline);
      else await skip(row, 'OTHER', ctx.blocked.reason);
      continue;
    }

    const paramCtx = { contactName: lead.name, companyName: ctx.companyName };
    let sendResult: { success: boolean; messageId?: string; error?: unknown };
    let sentBody: string;

    try {
      if (isConversation) {
        if (!lastMessage) {
          await skip(row, 'NOT_WAITING', 'Não há histórico da conversa para conferir o contexto.');
          continue;
        }

        sentBody = renderFollowUpText(settings.conversation_message, paramCtx);

        const byKeywords = checkContextByKeywords(messages);
        if (byKeywords && byKeywords.ok && !byKeywords.send) {
          await skip(row, 'CONTEXT', `Evitado: ${byKeywords.reason.toLowerCase()}.`);
          continue;
        }
        if (settings.ai_check_enabled) {
          const verdict = await checkContextWithAI(messages, sentBody, ctx.companyName);
          if (!verdict.ok) {
            await retryLater(row, `Checagem de contexto indisponível: ${verdict.error}.`, windowDeadline);
            continue;
          }
          if (!verdict.send) {
            await skip(row, 'CONTEXT', `Evitado: ${verdict.reason}`);
            continue;
          }
        }

        sendResult = await sendMetaText({ to: lead.phone, textBody: sentBody, credentials: ctx.credentials! });
      } else {
        if (!ctx.campaignTemplate) ctx.campaignTemplate = await loadCampaignTemplate(row.tenant_id, settings);
        const tpl = ctx.campaignTemplate!;
        if (!tpl.ok) {
          if (tpl.transient) await retryLater(row, tpl.reason, null);
          else await skip(row, 'OTHER', tpl.reason);
          continue;
        }
        sentBody = renderWithParams(tpl.bodyText, tpl.variables, resolveParamValues(tpl.params, paramCtx));
        sendResult = await sendMetaTemplate({
          to: lead.phone,
          templateName: tpl.name,
          languageCode: tpl.language,
          credentials: ctx.credentials!,
          components: buildBodyComponent(tpl.params, paramCtx),
        });
      }
    } catch (err) {
      await update(row, {
        status: 'FAILED',
        error_message: (err instanceof Error ? err.message : 'Erro ao enviar via Meta.').slice(0, 500),
      });
      result.failed += 1;
      continue;
    }

    if (!sendResult.success || !sendResult.messageId) {
      await update(row, { status: 'FAILED', error_message: formatMetaError(sendResult.error).slice(0, 500) });
      result.failed += 1;
      continue;
    }

    await update(row, { status: 'SENT', wamid: sendResult.messageId, sent_at: new Date().toISOString(), error_message: null });
    result.sent += 1;

    await supabaseAdmin.from('chat_messages').insert({
      tenant_id: row.tenant_id,
      lead_id: row.lead_id,
      direction: 'OUTBOUND',
      sender_type: 'AUTOMATION',
      message_type: isConversation ? 'TEXT' : 'TEMPLATE',
      body: sentBody,
      wamid: sendResult.messageId,
      status: 'SENT',
    });
  }

  return result;
}

/**
 * Linhas presas em PROCESSING (a função morreu no meio do envio). Não volta
 * para a fila: a mensagem pode ter saído e reenviar duplicaria para o contato.
 */
export async function failStuckFollowUps(): Promise<void> {
  await supabaseAdmin
    .from('follow_ups')
    .update({
      status: 'FAILED',
      error_message: 'Envio interrompido. Para não duplicar a mensagem, não foi reenviado.',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'PROCESSING')
    .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
}
