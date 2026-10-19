/**
 * Consumo e qualidade da atendente de IA (regras puras, sem banco).
 * Cada execução vira uma linha em assistant_runs com tokens, custo e sinais
 * de "conferir esta resposta" — o /interno agrega isso por cliente.
 */

export type TokenUsage = {
  calls: number;
  input: number;
  output: number;
  /** Parte da entrada que veio do cache do Gemini (cobrada mais barato). */
  cached: number;
};

export const emptyUsage = (): TokenUsage => ({ calls: 0, input: 0, output: 0, cached: 0 });

/** Soma o usageMetadata de uma resposta do Gemini. */
export function addUsage(usage: TokenUsage, meta: unknown): void {
  const m = (meta || {}) as Record<string, unknown>;
  usage.calls += 1;
  usage.input += Number(m.promptTokenCount) || 0;
  usage.output += (Number(m.candidatesTokenCount) || 0) + (Number(m.thoughtsTokenCount) || 0);
  usage.cached += Number(m.cachedContentTokenCount) || 0;
}

type Price = { input: number; output: number; cached: number };

/**
 * US$ por 1 milhão de tokens. O Gemini 3.8 Flash tem preço promocional até
 * 31/12/2026 e dobra a partir de 2027. Modelo fora da tabela usa o preço
 * cheio do Flash (melhor superestimar custo do que esconder).
 */
const PRICES: Record<string, { until?: string; price: Price }[]> = {
  'gemini-3.8-flash': [
    { until: '2027-01-01', price: { input: 0.75, output: 3.75, cached: 0.075 } },
    { price: { input: 1.5, output: 7.5, cached: 0.15 } },
  ],
};
const FALLBACK_PRICE: Price = { input: 1.5, output: 7.5, cached: 0.15 };

export function priceFor(model: string, at: Date = new Date()): Price {
  const tiers = PRICES[model];
  if (!tiers) return FALLBACK_PRICE;
  const iso = at.toISOString();
  return (tiers.find((t) => !t.until || iso < t.until) || tiers[tiers.length - 1]).price;
}

export function costUsd(usage: TokenUsage, model: string, at: Date = new Date()): number {
  const p = priceFor(model, at);
  const cached = Math.min(usage.cached, usage.input);
  const cost = ((usage.input - cached) * p.input + cached * p.cached + usage.output * p.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Custo da mesma execução no preço cheio (2027) — para precificar sem susto quando a promoção acabar. */
export function costUsdFullPrice(usage: TokenUsage, model: string): number {
  return costUsd(usage, model, new Date('2027-06-01T00:00:00Z'));
}

export type AssistantRunStatus = 'REPLIED' | 'SKIPPED' | 'NO_REPLY' | 'FAILED' | 'SUPERSEDED';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Data (AAAA-MM-DD) no horário de Brasília. */
export function brtDate(at: Date | string): string {
  return new Date(new Date(at).getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Meia-noite do dia 1 do mês corrente em Brasília, em ISO UTC. */
export function brtMonthStartIso(now: Date = new Date()): string {
  const [y, m] = brtDate(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) + BRT_OFFSET_MS).toISOString();
}

/** Conversas = pares contato+dia distintos entre as execuções que responderam. */
export function conversationKeys(runs: { lead_id: string | null; created_at: string }[]): Set<string> {
  const keys = new Set<string>();
  for (const r of runs) if (r.lead_id) keys.add(`${r.lead_id}:${brtDate(r.created_at)}`);
  return keys;
}

export type QuotaCheck = {
  allowed: boolean;
  /** Esta mensagem abre uma conversa nova (conta na cota). */
  opensConversation: boolean;
  /** Avisar o dono: 'WARN' ao chegar em 80%, 'EXHAUSTED' na primeira barrada do mês. */
  notify: 'WARN' | 'EXHAUSTED' | null;
};

/**
 * Conversa que já começou hoje sempre continua — cortar o cliente no meio do
 * agendamento é pior que estourar a cota em uma conversa.
 */
export function checkAssistantQuota(input: {
  limit: number;
  used: number;
  continuingToday: boolean;
  alreadyBlockedThisMonth: boolean;
}): QuotaCheck {
  if (input.continuingToday) return { allowed: true, opensConversation: false, notify: null };
  if (input.used >= input.limit) {
    return { allowed: false, opensConversation: false, notify: input.alreadyBlockedThisMonth ? null : 'EXHAUSTED' };
  }
  const warnAt = Math.ceil(input.limit * 0.8);
  return { allowed: true, opensConversation: true, notify: input.used + 1 === warnAt ? 'WARN' : null };
}

/**
 * Sinais automáticos para revisar. Não provam erro — apontam onde olhar:
 * - VALOR_NAO_CADASTRADO: citou um R$ que não está nos serviços nem nas regras da loja.
 * - HORARIO_SEM_AGENDA: ofereceu horários sem consultar a agenda nesta resposta.
 * - NAO_SABIA: disse que não tem a informação (bom sinal de dado faltando na loja).
 * - CHAMOU_EQUIPE: passou a conversa para uma pessoa.
 * - ERRO_FERRAMENTA: alguma ferramenta (agenda) falhou.
 */
export type AssistantFlag =
  | 'VALOR_NAO_CADASTRADO'
  | 'HORARIO_SEM_AGENDA'
  | 'NAO_SABIA'
  | 'CHAMOU_EQUIPE'
  | 'ERRO_FERRAMENTA';

export const FLAG_LABELS: Record<AssistantFlag, string> = {
  VALOR_NAO_CADASTRADO: 'Valor não cadastrado',
  HORARIO_SEM_AGENDA: 'Horário sem consultar agenda',
  NAO_SABIA: 'Não tinha a informação',
  CHAMOU_EQUIPE: 'Chamou a equipe',
  ERRO_FERRAMENTA: 'Erro na agenda',
};

const UNKNOWN_PATTERNS = [
  /n[aã]o tenho (essa|esta|a) informa/,
  /n[aã]o sei (te )?(informar|dizer)/,
  /(equipe|pessoal) (vai |pode )?confirm/,
  /vou confirmar com a equipe/,
  /n[aã]o consigo (te )?(informar|confirmar)/,
];

/** "R$ 1.234,56" / "R$55" → 1234.56 / 55 */
export function extractBrlValues(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/g)) {
    const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function detectFlags(input: {
  reply: string;
  knownPrices: number[];
  ownerText: string;
  tools: { name: string; ok: boolean }[];
}): AssistantFlag[] {
  const flags = new Set<AssistantFlag>();
  const reply = input.reply || '';
  const lower = reply.toLowerCase();

  const allowed = new Set([...input.knownPrices, ...extractBrlValues(input.ownerText)].map((v) => Math.round(v * 100)));
  if (extractBrlValues(reply).some((v) => !allowed.has(Math.round(v * 100)))) flags.add('VALOR_NAO_CADASTRADO');

  const usedAgenda = input.tools.some((t) => t.name === 'consultar_horarios_livres' || t.name === 'agendar');
  const timesOffered = (reply.match(/\b([01]?\d|2[0-3])[:h][0-5]\d\b/g) || []).length;
  if (timesOffered >= 2 && !usedAgenda) flags.add('HORARIO_SEM_AGENDA');

  if (UNKNOWN_PATTERNS.some((re) => re.test(lower))) flags.add('NAO_SABIA');
  if (input.tools.some((t) => t.name === 'chamar_equipe' && t.ok)) flags.add('CHAMOU_EQUIPE');
  if (input.tools.some((t) => !t.ok)) flags.add('ERRO_FERRAMENTA');
  return [...flags];
}
