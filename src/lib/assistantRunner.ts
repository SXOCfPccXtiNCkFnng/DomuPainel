/**
 * Assistente de IA no WhatsApp (segmento automotivo). Roda depois que o
 * webhook já respondeu 200 para a Meta: espera o cliente terminar de digitar,
 * confere se pode responder, conversa com o Gemini (com as ferramentas de
 * agenda) e envia a resposta.
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

async function callGemini(apiKey: string, systemPrompt: string, contents: GeminiTurn[]) {
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
            temperature: 0.7,
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
    const content = data?.candidates?.[0]?.content as { role?: string; parts?: GeminiPart[] } | undefined;
    return content?.parts?.length ? content : null;
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
  deadline: number
): Promise<string | null> {
  const contents = [...history];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (Date.now() > deadline) return null;
    const content = await callGemini(apiKey, systemPrompt, contents);
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

export async function runAssistantForTrigger(trigger: AssistantTrigger): Promise<void> {
  const { tenantId, leadId } = trigger;
  const startedAt = Date.now();
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
      logger.info('assistant.skipped', { tenantId, leadId, reason: decision.reason });
      if (decision.reason === 'RATE_LIMIT') {
        await supabaseAdmin
          .from('leads')
          .update({ assistant_paused_until: new Date(now.getTime() + HUMAN_PAUSE_MS).toISOString() })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);
        await notifyTenantAdmins(tenantId, {
          title: 'Assistente pausada em uma conversa',
          message: `A conversa com ${lead.name} passou do limite de mensagens por hora. A assistente parou de responder esse contato por 12 horas.`,
          type: 'WARNING',
        });
      }
      return;
    }

    const companyName = tenant.name || 'a loja';
    const services = ((servicesRes.data || []) as ServiceItem[]).map((s) => ({
      ...s,
      price: s.price == null ? null : Number(s.price),
    }));
    const systemPrompt = buildAssistantSystemPrompt({
      settings: assistantSettingsFromRow(settingsRow),
      companyName,
      services,
      scheduling,
      now,
    });

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

    const reply = await generateReply(
      apiKey,
      systemPrompt,
      toGeminiContents(history),
      toolCtx,
      startedAt + RUN_BUDGET_MS
    );
    const bubbles = reply ? splitReply(reply) : [];
    if (!bubbles.length) {
      logger.error('assistant.no_reply', { tenantId, leadId });
      await notifyTenantAdmins(tenantId, {
        title: 'Assistente não conseguiu responder',
        message: `${lead.name} mandou mensagem e a assistente não conseguiu responder. Responda pelo WhatsApp Business.`,
        type: 'WARNING',
      });
      return;
    }

    // Chegou mensagem nova enquanto a IA pensava: a execução dela responde, com tudo no contexto.
    if ((await latestInboundId(tenantId, leadId)) !== trigger.messageId) return;

    const wa = await requireVerifiedWhatsApp(tenantId);
    if (!wa.ok) {
      logger.warn('assistant.whatsapp_unavailable', { tenantId, error: wa.error });
      return;
    }

    for (let i = 0; i < bubbles.length; i++) {
      if (i > 0) await sleep(BUBBLE_GAP_MS);
      const sent = await sendMetaText({ to: lead.phone, textBody: bubbles[i], credentials: wa.credentials });
      if (!sent.success || !sent.messageId) {
        logger.error('assistant.send_failed', { tenantId, leadId, error: sent.error });
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
    logger.info('assistant.replied', { tenantId, leadId, bubbles: bubbles.length, ms: Date.now() - startedAt });
  } catch (err) {
    logger.error('assistant.run_failed', {
      tenantId,
      leadId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
