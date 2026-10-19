/**
 * Assistente de IA no WhatsApp (segmento automotivo). Roda depois que o
 * webhook já respondeu 200 para a Meta: espera o cliente terminar de digitar,
 * confere se pode responder, conversa com o Gemini (com as ferramentas de
 * agenda) e envia a resposta. Toda execução que passa da espera vira uma
 * linha em assistant_runs (consumo e monitor de conversas no /interno).
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { isAutomotiveSegment } from '@/lib/segmentConfig';
import { isOptOutMessage, sendMetaText } from '@/lib/metaClient';
import { requireVerifiedWhatsApp } from '@/lib/whatsappConnection';
import { notifyTenantAdmins } from '@/lib/notify';
import { assistantSettingsFromRow, buildAssistantSystemPrompt } from '@/lib/assistantPrompt';
import {
  ASSISTANT_SENDER_TYPE,
  DEBOUNCE_MS,
  HISTORY_LIMIT,
  HUMAN_PAUSE_MS,
  HUMAN_SENDER_TYPES,
  shouldAssistantReply,
  splitReply,
  toGeminiContents,
  type HistoryMessage,
} from '@/lib/assistantRules';
import { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool, type AssistantToolContext } from '@/lib/assistantTools';
import { loadSchedulingSettings } from '@/lib/schedulingServer';
import type { ServiceItem } from '@/lib/scheduling';
import {
  addUsage,
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
/** Limite da função na Vercel é 60 s: passou disso, desiste antes de ser cortada no meio. */
const RUN_BUDGET_MS = 50_000;
const BUBBLE_GAP_MS = 1_200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GeminiPart = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
};
type GeminiTurn = { role: 'user' | 'model'; parts: Record<string, unknown>[] };
type ToolCall = { name: string; ok: boolean };

async function callGemini(apiKey: string, systemPrompt: string, contents: GeminiTurn[], usage: TokenUsage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const request = () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ functionDeclarations: ASSISTANT_TOOL_DECLARATIONS }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    let res = await request();
    if (res.status === 500 || res.status === 503) {
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
  toolCtx: AssistantToolContext,
  deadline: number,
  usage: TokenUsage,
  toolLog: ToolCall[]
): Promise<string | null> {
  const contents = [...history];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (Date.now() > deadline) return null;
    const content = await callGemini(apiKey, systemPrompt, contents, usage);
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
        result = await executeAssistantTool(name, args || {}, toolCtx);
      } catch (err) {
        logger.error('assistant.tool_failed', {
          tool: name,
          tenantId: toolCtx.tenantId,
          message: err instanceof Error ? err.message : String(err),
        });
        result = { erro: 'Falha temporária no sistema. Peça desculpas e diga que a equipe vai confirmar.' };
      }
      toolLog.push({ name, ok: !result.erro && result.ok !== false });
      logger.info('assistant.tool_called', { tool: name, tenantId: toolCtx.tenantId });
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
      booked: run.tools.some((t) => t.name === 'agendar' && t.ok),
      handoff: run.tools.some((t) => t.name === 'chamar_equipe' && t.ok),
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

export async function runAssistantForTrigger(trigger: AssistantTrigger): Promise<void> {
  const { tenantId, leadId } = trigger;
  const usage = emptyUsage();
  const toolLog: ToolCall[] = [];
  let customerMessage: string | null = null;
  let aiStartedAt: number | null = null;
  try {
    // Barato primeiro: a grande maioria das contas não usa o assistente.
    const [{ data: tenant }, { data: settingsRow }] = await Promise.all([
      supabaseAdmin.from('tenants').select('name, segment').eq('id', tenantId).maybeSingle(),
      supabaseAdmin.from('assistant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    ]);
    if (!tenant || !isAutomotiveSegment(tenant.segment) || !settingsRow?.enabled) return;

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
    const [leadRes, historyRes, humanRes, botCountRes, servicesRes, scheduling] = await Promise.all([
      supabaseAdmin
        .from('leads')
        .select('name, phone, assistant_paused_until')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
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
      supabaseAdmin
        .from('services')
        .select('id, name, description, duration_minutes, price, active')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name', { ascending: true }),
      loadSchedulingSettings(tenantId),
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

    const companyName = tenant.name || 'a loja';
    const settings = assistantSettingsFromRow(settingsRow);
    const services = ((servicesRes.data || []) as ServiceItem[]).map((s) => ({
      ...s,
      price: s.price == null ? null : Number(s.price),
    }));
    const systemPrompt = buildAssistantSystemPrompt({ settings, companyName, services, scheduling, now });

    const toolCtx: AssistantToolContext = {
      tenantId,
      leadId,
      leadPhone: lead.phone,
      leadName: lead.name || 'Cliente',
      companyName,
      lastCustomerMessage: lastMessage.body || '',
      services,
      scheduling,
      now,
    };

    aiStartedAt = Date.now();
    const reply = await generateReply(
      apiKey,
      systemPrompt,
      toGeminiContents(history),
      toolCtx,
      aiStartedAt + RUN_BUDGET_MS - DEBOUNCE_MS,
      usage,
      toolLog
    );
    const aiMs = Date.now() - aiStartedAt;
    const bubbles = reply ? splitReply(reply) : [];
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
      knownPrices: services.filter((s) => s.price != null).map((s) => s.price as number),
      ownerText: `${settings.extra_info}\n${settings.about}`,
      tools: toolLog,
    });

    // Chegou mensagem nova enquanto a IA pensava: a execução dela responde, com tudo no contexto.
    if ((await latestInboundId(tenantId, leadId)) !== trigger.messageId) {
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
