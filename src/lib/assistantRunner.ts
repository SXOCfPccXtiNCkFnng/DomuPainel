/**
 * Assistente de IA no WhatsApp (lava rápido e imobiliário). Roda depois que o
 * webhook já respondeu 200 para a Meta: espera o cliente terminar de digitar,
 * confere se pode responder, conversa com o Gemini (com as ferramentas do
 * ramo: agenda ou catálogo de imóveis) e envia a resposta. Toda execução que passa da espera vira uma
 * linha em assistant_runs (consumo e monitor de conversas no /interno).
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { isRealEstateSegment } from '@/lib/segmentConfig';
import { schedulingVerticalOf, type SchedulingVertical } from '@/lib/schedulingVerticals';
import { isOptOutMessage, sendMetaText } from '@/lib/metaClient';
import { requireVerifiedWhatsApp } from '@/lib/whatsappConnection';
import { notifyTenantAdmins } from '@/lib/notify';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import {
  activePromo,
  assistantSettingsFromRow,
  buildAssistantSystemPrompt,
  type AssistantSettings,
} from '@/lib/assistantPrompt';
import { buildRealEstateSystemPrompt } from '@/lib/realEstatePrompt';
import { executeRealEstateTool, realEstateToolDeclarations, type RealEstateToolContext } from '@/lib/realEstateTools';
import { OFFERABLE_STATUSES, propertyFromRow, realEstateModeForPlan } from '@/lib/realEstate';
import { getPlanPropertyLimit } from '@/lib/planLimits';
import {
  ASSISTANT_SENDER_TYPE,
  DEBOUNCE_MS,
  HISTORY_LIMIT,
  HUMAN_PAUSE_MS,
  HUMAN_SENDER_TYPES,
  shouldAssistantReply,
  fallbackReplyForEffects,
  splitReply,
  toGeminiContents,
  type HistoryMessage,
  type ToolEffects,
} from '@/lib/assistantRules';
import {
  assistantToolDeclarations,
  executeAssistantTool,
  type AssistantToolContext,
  type HandoffContext,
} from '@/lib/assistantTools';
import { loadSchedulingSettings } from '@/lib/schedulingServer';
import type { ServiceItem } from '@/lib/scheduling';
import { loadAssistantQuota } from '@/lib/assistantQuota';
import {
  addUsage,
  checkAssistantQuota,
  costUsd,
  costUsdFullPrice,
  detectFlags,
  emptyUsage,
  type AssistantFlag,
  type AssistantRunStatus,
  type TokenUsage,
} from '@/lib/assistantUsage';

export type AssistantTrigger = { tenantId: string; leadId: string; messageId: string };

const GEMINI_MODEL = process.env.GEMINI_ASSISTANT_MODEL || 'gemini-3.8-flash';
const AI_TIMEOUT_MS = 20_000;
const MAX_TOOL_ROUNDS = 6;
/**
 * Limite da função na Vercel é 60 s (contando o webhook): a IA precisa terminar
 * até RUN_BUDGET_MS depois do início da execução, deixando SEND_RESERVE_MS para
 * enviar as mensagens e gravar o registro antes de a função ser cortada.
 */
const RUN_BUDGET_MS = 50_000;
const SEND_RESERVE_MS = 8_000;
/** Menos que isso não vale começar outra chamada ao Gemini. */
const MIN_CALL_MS = 3_000;
const BUBBLE_GAP_MS = 1_200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GeminiPart = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
};
type GeminiTurn = { role: 'user' | 'model'; parts: Record<string, unknown>[] };
type ToolCall = { name: string; ok: boolean };

/** Ferramentas de um ramo: o que o Gemini pode chamar e quem executa. */
type ToolKit = {
  declarations: unknown[];
  execute: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

/** Ferramentas que agem de verdade (o cliente precisa saber o resultado). */
const BOOKING_TOOLS = ['agendar', 'solicitar_visita'];
const HANDOFF_TOOLS = ['chamar_equipe', 'chamar_corretor'];

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  contents: GeminiTurn[],
  usage: TokenUsage,
  deadline: number,
  declarations: unknown[]
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(AI_TIMEOUT_MS, deadline - Date.now()));
  try {
    const request = () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ functionDeclarations: declarations }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    let res = await request();
    if ((res.status === 500 || res.status === 503) && deadline - Date.now() > MIN_CALL_MS + 2000) {
      await sleep(2000);
      res = await request();
    }
    if (!res.ok) {
      logger.error('assistant.ai_http_error', { status: res.status, model: GEMINI_MODEL });
      return null;
    }
    const data = await res.json();
    addUsage(usage, data?.usageMetadata);
    const content = data?.candidates?.[0]?.content as { role?: string; parts?: GeminiPart[] } | undefined;
    if (!content?.parts?.length) {
      logger.warn('assistant.ai_empty_response', {
        model: GEMINI_MODEL,
        finishReason: data?.candidates?.[0]?.finishReason ?? null,
        blockReason: data?.promptFeedback?.blockReason ?? null,
      });
      return null;
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Conversa com o Gemini até ele devolver texto (executando as ferramentas que pedir no caminho). */
async function generateReply(
  apiKey: string,
  systemPrompt: string,
  history: GeminiTurn[],
  toolkit: ToolKit,
  tenantId: string,
  deadline: number,
  usage: TokenUsage,
  toolLog: ToolCall[],
  effects: ToolEffects
): Promise<string | null> {
  const contents = [...history];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (deadline - Date.now() < MIN_CALL_MS) return null;
    const content = await callGemini(apiKey, systemPrompt, contents, usage, deadline, toolkit.declarations).catch((err) => {
      // Timeout (AbortError) ou rede: segue como "sem resposta" — o fallback cuida do cliente.
      logger.warn('assistant.ai_call_failed', { message: err instanceof Error ? err.message : String(err) });
      return null;
    });
    if (!content?.parts) return null;

    const calls = content.parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = content.parts
        .filter((p) => !p.thought)
        .map((p) => p.text || '')
        .join('')
        .trim();
      return text || null;
    }

    // Devolve a resposta do modelo como veio (inclui as assinaturas de raciocínio).
    contents.push({ role: 'model', parts: content.parts as Record<string, unknown>[] });
    const responses: Record<string, unknown>[] = [];
    for (const part of calls) {
      const { name, args } = part.functionCall!;
      let result: Record<string, unknown>;
      try {
        result = await toolkit.execute(name, args || {});
      } catch (err) {
        logger.error('assistant.tool_failed', {
          tool: name,
          tenantId,
          message: err instanceof Error ? err.message : String(err),
        });
        result = { erro: 'Falha temporária no sistema. Peça desculpas e diga que a equipe vai confirmar.' };
      }
      const ok = !result.erro && result.ok !== false;
      toolLog.push({ name, ok });
      if (ok && name === 'agendar' && result.agendamento) effects.booked.push(result.agendamento as Record<string, unknown>);
      if (ok && name === 'solicitar_visita' && result.visita) effects.visits.push(result.visita as Record<string, unknown>);
      if (ok && name === 'cancelar_agendamento') effects.cancelled++;
      if (ok && HANDOFF_TOOLS.includes(name)) effects.handoff = true;
      logger.info('assistant.tool_called', { tool: name, tenantId });
      responses.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return null;
}

async function latestInboundId(tenantId: string, leadId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('chat_messages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .eq('direction', 'INBOUND')
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/** Mensagens do cliente desde a última resposta da loja — o que esta execução respondeu. */
function pendingCustomerText(history: HistoryMessage[]): string {
  const out: string[] = [];
  for (let i = history.length - 1; i >= 0 && history[i].direction === 'INBOUND'; i--) {
    if (history[i].body) out.unshift(String(history[i].body));
  }
  return out.join('\n').slice(0, 2000);
}

type RunRecord = {
  status: AssistantRunStatus;
  reason?: string | null;
  usage: TokenUsage;
  tools: ToolCall[];
  aiMs?: number | null;
  responseMs?: number | null;
  bubbles?: number;
  flags?: AssistantFlag[];
  customerMessage?: string | null;
  replyText?: string | null;
  error?: string | null;
};

let runsTableMissingLogged = false;

/** Grava a execução. Nunca lança: medir não pode derrubar o atendimento. */
async function recordRun(trigger: AssistantTrigger, run: RunRecord): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('assistant_runs').insert({
      tenant_id: trigger.tenantId,
      lead_id: trigger.leadId,
      trigger_message_id: trigger.messageId,
      status: run.status,
      reason: run.reason?.slice(0, 60) ?? null,
      model: GEMINI_MODEL,
      ai_calls: run.usage.calls,
      input_tokens: run.usage.input,
      output_tokens: run.usage.output,
      cached_tokens: run.usage.cached,
      cost_usd: costUsd(run.usage, GEMINI_MODEL),
      cost_usd_full: costUsdFullPrice(run.usage, GEMINI_MODEL),
      ai_ms: run.aiMs ?? null,
      response_ms: run.responseMs ?? null,
      tools: run.tools.map((t) => t.name),
      tool_errors: run.tools.filter((t) => !t.ok).length,
      booked: run.tools.some((t) => BOOKING_TOOLS.includes(t.name) && t.ok),
      handoff: run.tools.some((t) => HANDOFF_TOOLS.includes(t.name) && t.ok),
      bubbles: run.bubbles ?? 0,
      flags: run.flags ?? [],
      customer_message: run.customerMessage ?? null,
      reply_text: run.replyText?.slice(0, 4000) ?? null,
      error: run.error?.slice(0, 1000) ?? null,
    });
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        if (!runsTableMissingLogged) {
          runsTableMissingLogged = true;
          logger.warn('assistant.runs_table_missing', {
            message: 'Tabela assistant_runs não existe: aplique a migration 20261019_assistant_runs.sql.',
          });
        }
        return;
      }
      logger.warn('assistant.run_record_failed', { tenantId: trigger.tenantId, message: error.message });
    }
  } catch (err) {
    logger.warn('assistant.run_record_failed', {
      tenantId: trigger.tenantId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

type LeadForAssistant = {
  name: string;
  phone: string;
  assistant_paused_until: string | null;
  assistant_disabled?: boolean | null;
  assistant_resumed_at?: string | null;
};

/** Contato com o controle da atendente (sem a migration 20261022, segue sem ele). */
async function loadLeadForAssistant(tenantId: string, leadId: string): Promise<{ data: LeadForAssistant | null }> {
  const select = (columns: string) =>
    supabaseAdmin.from('leads').select(columns).eq('id', leadId).eq('tenant_id', tenantId).maybeSingle();
  const full = await select('name, phone, assistant_paused_until, assistant_disabled, assistant_resumed_at');
  if (full.error?.code === '42703') {
    const basic = await select('name, phone, assistant_paused_until');
    return { data: (basic.data as LeadForAssistant | null) ?? null };
  }
  return { data: (full.data as LeadForAssistant | null) ?? null };
}

type Vertical = SchedulingVertical | 'imobiliario';

/** Ramos que têm atendente de IA: os de agenda (lava rápido, saúde e beleza) e o imobiliário. */
export function assistantVertical(segment: string | null | undefined): Vertical | null {
  const scheduling = schedulingVerticalOf(segment);
  if (scheduling) return scheduling;
  if (isRealEstateSegment(segment ?? null)) return 'imobiliario';
  return null;
}

type VerticalInput = HandoffContext & { settings: AssistantSettings; planTier: string | null };
type VerticalSetup = { systemPrompt: string; toolkit: ToolKit; knownPrices: number[] };

/** Carrega o que cada ramo precisa e monta o prompt e as ferramentas. */
async function prepareVertical(vertical: Vertical, input: VerticalInput): Promise<VerticalSetup> {
  const { settings, planTier, ...base } = input;

  if (vertical !== 'imobiliario') {
    const [servicesRes, scheduling] = await Promise.all([
      supabaseAdmin
        .from('services')
        .select('id, name, description, duration_minutes, price, active')
        .eq('tenant_id', base.tenantId)
        .eq('active', true)
        .order('name', { ascending: true }),
      loadSchedulingSettings(base.tenantId),
    ]);
    const services = ((servicesRes.data || []) as ServiceItem[]).map((s) => ({
      ...s,
      price: s.price == null ? null : Number(s.price),
    }));
    const ctx: AssistantToolContext = { ...base, services, scheduling };
    return {
      systemPrompt: buildAssistantSystemPrompt({
        settings,
        companyName: base.companyName,
        services,
        scheduling,
        now: base.now,
        customerName: base.leadName,
        vertical,
      }),
      toolkit: {
        declarations: assistantToolDeclarations(vertical),
        execute: (name, args) => executeAssistantTool(name, args, ctx),
      },
      knownPrices: services.filter((s) => s.price != null).map((s) => s.price as number),
    };
  }

  // Imobiliário: o plano decide se a IA só abre a conversa (Starter) ou conduz até a visita.
  let tier = planTier;
  if (!tier) {
    const { data: sub } = await supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', base.tenantId).maybeSingle();
    tier = sub?.plan_tier ?? null;
  }
  const mode = realEstateModeForPlan(tier);
  const [propertiesRes, interestRes] = await Promise.all([
    supabaseAdmin
      .from('properties')
      .select('*')
      .eq('tenant_id', base.tenantId)
      .order('updated_at', { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from('leads')
      .select('interest_purpose, interest_property_type, region, budget_max, bedrooms_min, ai_summary')
      .eq('id', base.leadId)
      .eq('tenant_id', base.tenantId)
      .maybeSingle(),
  ]);
  if (propertiesRes.error) throw propertiesRes.error;
  // Limite do plano: conta que caiu de plano com catálogo maior oferece só os
  // imóveis ativos atualizados mais recentemente (a lista já vem nessa ordem).
  const catalogLimit = getPlanPropertyLimit(tier);
  let offered = 0;
  const properties = (propertiesRes.data || [])
    .map((row) => propertyFromRow(row as Record<string, unknown>))
    .filter((p) => !OFFERABLE_STATUSES.includes(p.status) || ++offered <= catalogLimit);
  const ctx: RealEstateToolContext = { ...base, mode, showPrices: settings.show_prices, properties };
  return {
    systemPrompt: buildRealEstateSystemPrompt({
      settings,
      companyName: base.companyName,
      mode,
      properties,
      customerName: base.leadName,
      // Sem a migration do módulo as colunas não existem: segue sem o histórico de interesse.
      knownInterest: interestRes.error ? null : interestRes.data,
      now: base.now,
    }),
    toolkit: { declarations: realEstateToolDeclarations(mode), execute: (name, args) => executeRealEstateTool(name, args, ctx) },
    knownPrices: properties.flatMap((p) => [p.price, p.rent_price, p.condo_fee].filter((n): n is number => n != null)),
  };
}

export async function runAssistantForTrigger(trigger: AssistantTrigger): Promise<void> {
  const { tenantId, leadId } = trigger;
  const usage = emptyUsage();
  const toolLog: ToolCall[] = [];
  const effects: ToolEffects = { booked: [], visits: [], cancelled: 0, handoff: false };
  const runStartedAt = Date.now();
  let customerMessage: string | null = null;
  let aiStartedAt: number | null = null;
  try {
    // Barato primeiro: a grande maioria das contas não usa o assistente.
    const [{ data: tenant }, { data: settingsRow }] = await Promise.all([
      supabaseAdmin.from('tenants').select('name, segment').eq('id', tenantId).maybeSingle(),
      supabaseAdmin.from('assistant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    ]);
    const vertical = tenant ? assistantVertical(tenant.segment) : null;
    if (!tenant || !vertical || !settingsRow?.enabled) return;

    // Assinatura cancelada, vencida ou sem pagamento: a atendente para (mesma regra dos disparos e lembretes).
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!isSubscriptionAllowedToDispatch(subscription?.status)) {
      logger.info('assistant.subscription_inactive', { tenantId, status: subscription?.status ?? null });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('assistant.no_api_key', { tenantId });
      await recordRun(trigger, { status: 'FAILED', reason: 'SEM_CHAVE_IA', usage, tools: toolLog });
      return;
    }

    // Cliente costuma mandar várias mensagens seguidas: só a última responde, com todas no contexto.
    await sleep(DEBOUNCE_MS);
    if ((await latestInboundId(tenantId, leadId)) !== trigger.messageId) return;

    const now = new Date();
    const [leadRes, historyRes, humanRes, botCountRes] = await Promise.all([
      loadLeadForAssistant(tenantId, leadId),
      supabaseAdmin
        .from('chat_messages')
        .select('direction, sender_type, body, created_at')
        .eq('tenant_id', tenantId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT),
      supabaseAdmin
        .from('chat_messages')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .eq('lead_id', leadId)
        .eq('direction', 'OUTBOUND')
        .in('sender_type', HUMAN_SENDER_TYPES)
        .gte('created_at', new Date(now.getTime() - HUMAN_PAUSE_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('lead_id', leadId)
        .eq('sender_type', ASSISTANT_SENDER_TYPE)
        .gte('created_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString()),
    ]);
    const lead = leadRes.data;
    if (!lead) return;

    const history = ((historyRes.data || []) as HistoryMessage[]).reverse();
    const lastMessage = history[history.length - 1];
    if (!lastMessage || lastMessage.direction !== 'INBOUND') return;
    customerMessage = pendingCustomerText(history);
    const customerSentAt = new Date(lastMessage.created_at).getTime();

    const decision = shouldAssistantReply({
      enabled: true,
      automotive: true,
      pausedUntil: lead.assistant_paused_until ? new Date(lead.assistant_paused_until) : null,
      lastHumanReplyAt: humanRes.data?.[0]?.created_at ? new Date(humanRes.data[0].created_at) : null,
      repliesLastHour: botCountRes.count ?? 0,
      isOptOut: isOptOutMessage(lastMessage.body || ''),
      now,
      disabledForContact: Boolean(lead.assistant_disabled),
      resumedAt: lead.assistant_resumed_at ? new Date(lead.assistant_resumed_at) : null,
    });
    if (!decision.reply) {
      if (decision.reason === 'RATE_LIMIT') {
        logger.warn('assistant.rate_limited', {
          tenantId,
          leadId,
          message: `Atendente pausada por 12h: ${botCountRes.count ?? 0} mensagens da IA na última hora.`,
        });
        await supabaseAdmin
          .from('leads')
          .update({ assistant_paused_until: new Date(now.getTime() + HUMAN_PAUSE_MS).toISOString() })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);
        await notifyTenantAdmins(tenantId, {
          title: 'Atendente pausada em uma conversa',
          message: `A conversa com ${lead.name} passou do limite de mensagens por hora. A atendente parou de responder esse contato por 12 horas.`,
          type: 'WARNING',
          url: '/atendente',
        });
      } else {
        logger.info('assistant.skipped', { tenantId, leadId, reason: decision.reason });
      }
      await recordRun(trigger, { status: 'SKIPPED', reason: decision.reason, usage, tools: toolLog, customerMessage });
      return;
    }

    const quota = await loadAssistantQuota(tenantId, now, leadId);
    if (quota) {
      const check = checkAssistantQuota({
        limit: quota.limit,
        used: quota.used,
        continuingToday: quota.continuingToday,
        alreadyBlockedThisMonth: quota.alreadyBlockedThisMonth,
      });
      if (check.notify === 'EXHAUSTED') {
        logger.info('assistant.quota_exhausted', { tenantId, plan: quota.planTier, limit: quota.limit });
        await notifyTenantAdmins(tenantId, {
          title: 'Acabaram as conversas da atendente neste mês',
          message: `Seu plano ${quota.planName} inclui ${quota.limit} conversas por mês com a atendente e todas já foram usadas. Conversas novas ficam com a sua equipe até o dia 1º. Para a atendente voltar agora, mude de plano.`,
          type: 'WARNING',
          url: '/assinatura',
        });
      } else if (check.notify === 'WARN') {
        await notifyTenantAdmins(tenantId, {
          title: 'Conversas da atendente acabando',
          message: `Você já usou 80% das ${quota.limit} conversas do mês da atendente (plano ${quota.planName}). Quando acabarem, conversas novas ficam com a sua equipe.`,
          type: 'WARNING',
          url: '/assinatura',
        });
      }
      if (!check.allowed) {
        await recordRun(trigger, { status: 'SKIPPED', reason: 'COTA_ESGOTADA', usage, tools: toolLog, customerMessage });
        return;
      }
    }

    const settings = assistantSettingsFromRow(settingsRow);
    const setup = await prepareVertical(vertical, {
      tenantId,
      leadId,
      leadPhone: lead.phone,
      leadName: lead.name || 'Cliente',
      companyName: tenant.name || (vertical === 'imobiliario' ? 'a imobiliária' : 'a loja'),
      lastCustomerMessage: lastMessage.body || '',
      now,
      settings,
      planTier: quota?.planTier ?? null,
    });

    aiStartedAt = Date.now();
    const reply = await generateReply(
      apiKey,
      setup.systemPrompt,
      toGeminiContents(history),
      setup.toolkit,
      tenantId,
      runStartedAt + RUN_BUDGET_MS - SEND_RESERVE_MS,
      usage,
      toolLog,
      effects
    );
    const aiMs = Date.now() - aiStartedAt;
    let bubbles = reply ? splitReply(reply) : [];
    const hasEffects =
      effects.booked.length > 0 || effects.visits.length > 0 || effects.cancelled > 0 || effects.handoff;
    if (!bubbles.length && hasEffects) {
      logger.warn('assistant.fallback_reply', { tenantId, leadId, tools: toolLog.map((t) => t.name) });
      bubbles = [fallbackReplyForEffects(effects)!];
    }
    if (!bubbles.length) {
      logger.error('assistant.no_reply', { tenantId, leadId });
      await notifyTenantAdmins(tenantId, {
        title: 'Atendente não conseguiu responder',
        message: `${lead.name} mandou mensagem e a atendente não conseguiu responder. Responda pelo WhatsApp Business.`,
        type: 'WARNING',
        url: '/atendente',
      });
      await recordRun(trigger, { status: 'NO_REPLY', reason: 'IA_SEM_RESPOSTA', usage, tools: toolLog, aiMs, customerMessage });
      return;
    }

    const replyText = bubbles.join('\n\n');
    const flags = detectFlags({
      reply: replyText,
      knownPrices: setup.knownPrices,
      ownerText: `${settings.extra_info}\n${settings.about}\n${activePromo(settings, now) || ''}`,
      tools: toolLog,
      checkScheduleTimes: vertical !== 'imobiliario',
    });

    // Chegou mensagem nova enquanto a IA pensava: a execução dela responde, com tudo no contexto.
    // Se esta já agendou/cancelou, responde mesmo assim — a próxima não sabe o que foi feito.
    if (!hasEffects && (await latestInboundId(tenantId, leadId)) !== trigger.messageId) {
      await recordRun(trigger, { status: 'SUPERSEDED', reason: 'MENSAGEM_NOVA', usage, tools: toolLog, aiMs, flags, customerMessage, replyText });
      return;
    }

    const wa = await requireVerifiedWhatsApp(tenantId);
    if (!wa.ok) {
      logger.warn('assistant.whatsapp_unavailable', { tenantId, error: wa.error });
      await recordRun(trigger, {
        status: 'FAILED',
        reason: 'WHATSAPP_INDISPONIVEL',
        usage,
        tools: toolLog,
        aiMs,
        flags,
        customerMessage,
        replyText,
        error: wa.error,
      });
      return;
    }

    for (let i = 0; i < bubbles.length; i++) {
      if (i > 0) await sleep(BUBBLE_GAP_MS);
      const sent = await sendMetaText({ to: lead.phone, textBody: bubbles[i], credentials: wa.credentials });
      if (!sent.success || !sent.messageId) {
        logger.error('assistant.send_failed', { tenantId, leadId, error: sent.error });
        await recordRun(trigger, {
          status: 'FAILED',
          reason: 'ENVIO_FALHOU',
          usage,
          tools: toolLog,
          aiMs,
          bubbles: i,
          flags,
          customerMessage,
          replyText,
          error: sent.error || null,
        });
        return;
      }
      await supabaseAdmin.from('chat_messages').insert({
        tenant_id: tenantId,
        lead_id: leadId,
        direction: 'OUTBOUND',
        sender_type: ASSISTANT_SENDER_TYPE,
        message_type: 'TEXT',
        body: bubbles[i],
        wamid: sent.messageId,
        status: 'SENT',
      });
    }
    const responseMs = Number.isFinite(customerSentAt) ? Date.now() - customerSentAt : null;
    logger.info('assistant.replied', {
      tenantId,
      leadId,
      bubbles: bubbles.length,
      aiMs,
      aiCalls: usage.calls,
      inputTokens: usage.input,
      outputTokens: usage.output,
    });
    await recordRun(trigger, {
      status: 'REPLIED',
      usage,
      tools: toolLog,
      aiMs,
      responseMs,
      bubbles: bubbles.length,
      flags,
      customerMessage,
      replyText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('assistant.run_failed', { tenantId, leadId, message });
    await recordRun(trigger, {
      status: 'FAILED',
      reason: 'ERRO_INTERNO',
      usage,
      tools: toolLog,
      aiMs: aiStartedAt ? Date.now() - aiStartedAt : null,
      customerMessage,
      error: message,
    });
  }
}
