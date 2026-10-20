/**
 * Regras puras do assistente de IA no WhatsApp (sem banco, sem rede) —
 * quando responder, como montar o histórico e como quebrar a resposta.
 */
import { describeBody } from '@/lib/followUpContext';
import type { ServiceItem } from '@/lib/scheduling';

/** Espera depois da última mensagem: quem manda "oi" / "quero lavar" / "amanhã" recebe uma resposta só. */
export const DEBOUNCE_MS = 6_000;
/** Alguém da equipe respondeu (celular ou painel) ou a IA chamou a equipe: ela fica quieta por esse tempo. */
export const HUMAN_PAUSE_MS = 12 * 60 * 60 * 1000;
export const HISTORY_LIMIT = 20;
export const MAX_REPLY_PARTS = 3;
/**
 * Trava contra loop com outro robô ou abuso: acima disso por hora, a IA para e avisa a equipe.
 * Conta balões enviados (cada resposta vira até MAX_REPLY_PARTS), então equivale a ~20 respostas.
 */
export const MAX_REPLIES_PER_HOUR = 20 * MAX_REPLY_PARTS;

/** Quem conta como "alguém da equipe respondeu". */
export const HUMAN_SENDER_TYPES = ['AGENT', 'AGENT_PHONE'];
export const ASSISTANT_SENDER_TYPE = 'BOT_AI';

export type SkipReason =
  | 'DISABLED'
  | 'WRONG_SEGMENT'
  | 'PAUSED_BY_HANDOFF'
  | 'HUMAN_REPLIED'
  | 'RATE_LIMIT'
  | 'OPT_OUT';

export function shouldAssistantReply(input: {
  enabled: boolean;
  automotive: boolean;
  pausedUntil: Date | null;
  lastHumanReplyAt: Date | null;
  repliesLastHour: number;
  isOptOut: boolean;
  now: Date;
}): { reply: true } | { reply: false; reason: SkipReason } {
  if (!input.automotive) return { reply: false, reason: 'WRONG_SEGMENT' };
  if (!input.enabled) return { reply: false, reason: 'DISABLED' };
  if (input.isOptOut) return { reply: false, reason: 'OPT_OUT' };
  if (input.pausedUntil && input.pausedUntil > input.now) return { reply: false, reason: 'PAUSED_BY_HANDOFF' };
  if (input.lastHumanReplyAt && input.now.getTime() - input.lastHumanReplyAt.getTime() < HUMAN_PAUSE_MS) {
    return { reply: false, reason: 'HUMAN_REPLIED' };
  }
  if (input.repliesLastHour >= MAX_REPLIES_PER_HOUR) return { reply: false, reason: 'RATE_LIMIT' };
  return { reply: true };
}

export type HistoryMessage = {
  direction: string;
  sender_type: string | null;
  body: string | null;
  created_at: string;
};

export type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] };

/**
 * Histórico → conteúdo do Gemini. Cliente = user; loja (IA, equipe,
 * campanha) = model. Mensagens seguidas do mesmo lado viram uma só e a
 * conversa sempre começa pelo cliente.
 */
export function toGeminiContents(history: HistoryMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of history) {
    const role = m.direction === 'INBOUND' ? 'user' : 'model';
    const text = describeBody(m.body);
    if (!text) continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  }
  if (contents[0]?.role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: '(início da conversa)' }] });
  }
  return contents;
}

/** Resposta da IA → até 3 balões, sem markdown (WhatsApp não precisa de ** nem #). */
export function splitReply(text: string): string[] {
  const clean = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\r/g, '')
    .trim();
  if (!clean) return [];
  const parts = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= MAX_REPLY_PARTS) return parts;
  return [...parts.slice(0, MAX_REPLY_PARTS - 1), parts.slice(MAX_REPLY_PARTS - 1).join('\n\n')];
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Serviço pelo nome que a IA mandou ("lavagem completa", "polimento"...). */
export function resolveService(
  services: ServiceItem[],
  query: unknown
): { ok: true; service: ServiceItem } | { ok: false; options: string[] } {
  const active = services.filter((s) => s.active);
  const q = normalizeText(String(query ?? ''));
  const options = active.map((s) => s.name);
  if (!q) return { ok: false, options };

  const exact = active.find((s) => normalizeText(s.name) === q);
  if (exact) return { ok: true, service: exact };

  const partial = active.filter((s) => {
    const name = normalizeText(s.name);
    return name.includes(q) || q.includes(name);
  });
  if (partial.length === 1) return { ok: true, service: partial[0] };
  return { ok: false, options: partial.length > 1 ? partial.map((s) => s.name) : options };
}

/** O que as ferramentas já fizeram de verdade nesta execução (o cliente precisa saber). */
export type ToolEffects = { booked: Record<string, unknown>[]; cancelled: number; handoff: boolean };

/**
 * Resposta fixa quando a IA não conseguiu terminar, mas uma ferramenta já
 * agiu (agendou, cancelou, chamou a equipe): o cliente não pode ficar sem saber.
 */
export function fallbackReplyForEffects(effects: ToolEffects): string | null {
  const parts: string[] = [];
  for (const b of effects.booked) {
    const [, month, day] = String(b.data || '').split('-');
    const when = [b.dia_da_semana, month && day ? `${day}/${month}` : null].filter(Boolean).join(', ');
    parts.push(`Agendamento confirmado ✅\n${b.servico}${when ? ` — ${when}` : ''}${b.horario ? ` às ${b.horario}` : ''}.`);
  }
  if (effects.cancelled) parts.push('Pronto, seu agendamento foi cancelado.');
  if (effects.handoff) parts.push('Já avisei a equipe. Em breve alguém te responde por aqui.');
  return parts.length ? parts.join('\n\n') : null;
}
