/**
 * Regras puras do assistente de IA no WhatsApp (sem banco, sem rede) —
 * quando responder, como montar o histórico e como quebrar a resposta.
 */
import { describeBody } from '@/lib/followUpContext';
import type { ServiceItem } from '@/lib/scheduling';
import { APPROACH_SESSION_GAP_MS, ASSISTANT_SENDER_TYPE, HUMAN_PAUSE_MS } from '@/lib/assistantTiming';

// Constantes compartilhadas com telas do painel (sem dependência de servidor).
export { APPROACH_SESSION_GAP_MS, ASSISTANT_SENDER_TYPE, HUMAN_PAUSE_MS };

/** Espera depois da última mensagem: quem manda "oi" / "quero lavar" / "amanhã" recebe uma resposta só. */
export const DEBOUNCE_MS = 6_000;
export const HISTORY_LIMIT = 20;
export const MAX_REPLY_PARTS = 3;
/**
 * Trava contra loop com outro robô ou abuso: acima disso por hora, a IA para e avisa a equipe.
 * Conta balões enviados (cada resposta vira até MAX_REPLY_PARTS), então equivale a ~20 respostas.
 */
export const MAX_REPLIES_PER_HOUR = 20 * MAX_REPLY_PARTS;

/** Quem conta como "alguém da equipe respondeu". */
export const HUMAN_SENDER_TYPES = ['AGENT', 'AGENT_PHONE'];

export type SkipReason =
  | 'DISABLED'
  | 'WRONG_SEGMENT'
  | 'PAUSED_BY_HANDOFF'
  | 'HUMAN_REPLIED'
  | 'RATE_LIMIT'
  | 'OPT_OUT'
  | 'DISABLED_FOR_CONTACT'
  | 'NOT_APPROACHED';

export function shouldAssistantReply(input: {
  enabled: boolean;
  automotive: boolean;
  pausedUntil: Date | null;
  lastHumanReplyAt: Date | null;
  repliesLastHour: number;
  isOptOut: boolean;
  now: Date;
  /** Desligada neste contato pela página Leads. */
  disabledForContact?: boolean;
  /** "Devolver para a atendente": resposta da equipe antes disso não pausa mais. */
  resumedAt?: Date | null;
  /** Atendente de vendas: só responde quem a gente abordou primeiro. */
  requireApproach?: boolean;
  /** A conversa começou com mensagem nossa (abordagem). */
  approached?: boolean;
  /** Mensagem da equipe até aqui foi a abordagem (antes de o contato responder): não pausa. */
  humanIgnoredUntil?: Date | null;
}): { reply: true } | { reply: false; reason: SkipReason } {
  if (!input.automotive) return { reply: false, reason: 'WRONG_SEGMENT' };
  if (!input.enabled) return { reply: false, reason: 'DISABLED' };
  if (input.disabledForContact) return { reply: false, reason: 'DISABLED_FOR_CONTACT' };
  if (input.isOptOut) return { reply: false, reason: 'OPT_OUT' };
  if (input.requireApproach && !input.approached) return { reply: false, reason: 'NOT_APPROACHED' };
  if (input.pausedUntil && input.pausedUntil > input.now) return { reply: false, reason: 'PAUSED_BY_HANDOFF' };
  const humanCounts =
    input.lastHumanReplyAt &&
    (!input.resumedAt || input.lastHumanReplyAt > input.resumedAt) &&
    (!input.humanIgnoredUntil || input.lastHumanReplyAt > input.humanIgnoredUntil);
  if (humanCounts && input.now.getTime() - input.lastHumanReplyAt!.getTime() < HUMAN_PAUSE_MS) {
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
export type ToolEffects = {
  booked: Record<string, unknown>[];
  /** Pedidos de visita (imobiliário): o corretor ainda confirma o horário. */
  visits: Record<string, unknown>[];
  /** Pedidos do delivery: a loja ainda aceita o pedido. */
  orders?: Record<string, unknown>[];
  cancelled: number;
  handoff: boolean;
};

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
  for (const v of effects.visits) {
    parts.push(
      `Pedido de visita registrado ✅\n${v.imovel}${v.preferencia ? ` — ${v.preferencia}` : ''}.\nO corretor vai confirmar o horário com você por aqui.`
    );
  }
  for (const o of effects.orders || []) {
    parts.push(`Pedido #${o.numero} registrado ✅${o.total ? `\nTotal: ${o.total}.` : ''}\nA loja vai confirmar e te avisar por aqui.`);
  }
  if (effects.cancelled) parts.push('Pronto, seu agendamento foi cancelado.');
  if (effects.handoff) parts.push('Já avisei a equipe. Em breve alguém te responde por aqui.');
  return parts.length ? parts.join('\n\n') : null;
}


/**
 * Vendedora: a conversa ATUAL começou com mensagem nossa? Conversa atual =
 * desde a última pausa de 7 dias. Assim um contato que já falou com o número
 * antes (outro assunto, outro teste) pode ser abordado de novo.
 * Devolve também quando ele respondeu pela primeira vez nessa conversa:
 * mensagens da equipe antes disso são a abordagem e não pausam a IA.
 */
export type ApproachInfo = {
  approached: boolean;
  firstReplyAt: Date | null;
  /** Quando a conversa atual começou (a abordagem). */
  startedAt: Date | null;
  /** Mensagens do contato na conversa atual, em ordem. */
  replies: { created_at: string; body: string | null }[];
};

export function approachFromHistory(
  messages: { direction: string; created_at: string; body?: string | null }[],
  gapMs: number = APPROACH_SESSION_GAP_MS
): ApproachInfo {
  const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (!sorted.length) return { approached: false, firstReplyAt: null, startedAt: null, replies: [] };
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime() >= gapMs) start = i;
  }
  const session = sorted.slice(start);
  const replies = session.filter((m) => m.direction === 'INBOUND').map((m) => ({ created_at: m.created_at, body: m.body ?? null }));
  return {
    approached: session[0].direction === 'OUTBOUND',
    firstReplyAt: replies[0] ? new Date(replies[0].created_at) : null,
    startedAt: new Date(session[0].created_at),
    replies,
  };
}

/** Frases de saudação e de ausência automáticas do WhatsApp Business. */
const AUTO_REPLY_RE =
  /bem[- ]?vind|agradece (o |seu |pelo )?contato|obrigad[oa] (pelo|por entrar em|por nos chamar|pela mensagem)|como (podemos|posso) (te |lhe )?ajudar|em breve (retornaremos|responderemos|entraremos)|retornaremos|responderemos (o mais|assim que)|assim que poss[íi]vel|no momento (n[ãa]o|estamos)|fora do (nosso )?hor[áa]rio|hor[áa]rio de (atendimento|funcionamento)|link (de|para) agendamento|agende (pelo|no|atrav[ée]s)|mensagem autom[áa]tica|atendimento autom[áa]tico/i;

/** Mensagem sem conteúdo que a API não entrega (resposta automática costuma chegar assim). */
const PLACEHOLDER_RE = /^\[(mensagem n[ãa]o suportada|unsupported|interactive|button|system|template)/i;

export const AUTO_REPLY_INSTANT_MS = 20_000;
export const AUTO_REPLY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Vendedora: a mensagem mais recente do contato parece a resposta automática
 * do WhatsApp Business dele (e não o dono respondendo)? Ela chegou logo depois
 * da abordagem e veio sem conteúdo, tem cara de saudação/ausência automática,
 * ou chegou em segundos com link ou texto longo. Resposta curta e rápida é gente.
 */
export function isLikelyAutoReply(info: Pick<ApproachInfo, 'startedAt' | 'replies'>): boolean {
  const last = info.replies[info.replies.length - 1];
  if (!info.startedAt || !last) return false;
  const delay = new Date(last.created_at).getTime() - info.startedAt.getTime();
  if (delay > AUTO_REPLY_WINDOW_MS) return false;
  const text = String(last.body || '').trim();
  if (PLACEHOLDER_RE.test(text) || AUTO_REPLY_RE.test(text)) return true;
  // Resposta em segundos com link ou texto longo de saudação: robô. Resposta curta e rápida ("sim, pode") é gente.
  return delay <= AUTO_REPLY_INSTANT_MS && (/https?:\/\/|www\.|\.com\b/i.test(text) || text.length > 120);
}
