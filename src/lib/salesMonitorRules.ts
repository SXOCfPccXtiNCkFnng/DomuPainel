/**
 * Aba Vendedora do /interno: regras puras de cada conversa de venda (etapa do
 * funil, se precisa do Alan, se a vendedora está atendendo, último motivo de
 * não responder). Os dados vêm de lib/salesMonitor.ts.
 */
import { APPROACH_SESSION_GAP_MS, ASSISTANT_SENDER_TYPE, HUMAN_PAUSE_MS } from '@/lib/assistantTiming';

export const SALES_STAGES = ['ABORDADO', 'RESPONDEU', 'INTERESSADO', 'CONTA', 'TESTE', 'CLIENTE'] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

export const SALES_STAGE_LABELS: Record<SalesStage, string> = {
  ABORDADO: 'Abordado',
  RESPONDEU: 'Respondeu',
  INTERESSADO: 'Interessado',
  CONTA: 'Criou conta',
  TESTE: 'Em teste grátis',
  CLIENTE: 'Cliente',
};

/** Motivos de "não respondeu" em linguagem do Alan. */
export const SALES_SKIP_LABELS: Record<string, string> = {
  HUMAN_REPLIED: 'Você respondeu, então ela ficou quieta por 12h',
  PAUSED_BY_HANDOFF: 'Pausada: chamou você (ou bateu o limite)',
  NAO_ABORDADO: 'Não foi abordado (a pessoa escreveu primeiro)',
  RESPOSTA_AUTOMATICA: 'Era a resposta automática do WhatsApp dela; esperando a pessoa responder',
  JA_E_CLIENTE: 'Já é cliente da Domu',
  RATE_LIMIT: 'Bateu o limite de mensagens por hora',
  OPT_OUT: 'A pessoa pediu para não receber mais',
  DISABLED_FOR_CONTACT: 'Desligada neste contato',
  IA_SEM_RESPOSTA: 'A IA não conseguiu responder',
  ERRO_INTERNO: 'Erro no sistema',
  ENVIO_FALHOU: 'A Meta recusou o envio',
  WHATSAPP_INDISPONIVEL: 'WhatsApp desconectado',
  SEM_CHAVE_IA: 'Chave da IA não configurada',
};

export const SALES_INTEREST_TOOL = 'avisar_interesse';
/** Passar a conversa para o time (o nome não cita ninguém: a IA lê o nome da ferramenta). */
export const SALES_HANDOFF_TOOL = 'chamar_time';
/** Nomes que já valeram (histórico de conversas antigas). */
export const SALES_HANDOFF_TOOLS = [SALES_HANDOFF_TOOL, 'chamar_alan'];

export type SalesMessage = { direction: string; sender_type: string | null; body: string | null; created_at: string };
export type SalesRun = { status: string; reason: string | null; tools: string[] | null; created_at: string };
export type SalesLeadRow = {
  id: string;
  name: string | null;
  phone: string;
  assistant_paused_until?: string | null;
  assistant_disabled?: boolean | null;
  assistant_resumed_at?: string | null;
};
export type SalesBusiness = { name: string; kind: string; module: string; city: string | null };
/** Conta na Domu com o mesmo telefone (status da assinatura). */
export type SalesAccount = { status: string | null; price: number };

export type SalesWho = 'VOCE' | 'VENDEDORA' | 'CLIENTE';

export type SalesConversation = {
  leadId: string;
  name: string;
  phone: string;
  business: SalesBusiness | null;
  /** A conversa atual começou com mensagem nossa. */
  approached: boolean;
  startedAt: string;
  lastAt: string;
  last: { who: SalesWho; text: string };
  messages: number;
  stage: SalesStage;
  interested: boolean;
  /** A vendedora te chamou e você ainda não respondeu. */
  needsYou: boolean;
  ai: 'ATENDENDO' | 'PAUSADA' | 'DESLIGADA';
  pausedUntil: string | null;
  /** Última vez que ela não respondeu (depois da última resposta dela). */
  lastSkip: { status: string; reason: string | null; label: string; at: string } | null;
};

export function whoSent(m: Pick<SalesMessage, 'direction' | 'sender_type'>): SalesWho {
  if (m.direction === 'INBOUND') return 'CLIENTE';
  return m.sender_type === ASSISTANT_SENDER_TYPE ? 'VENDEDORA' : 'VOCE';
}

const t = (iso: string) => new Date(iso).getTime();

/** Mensagens da conversa atual (desde a última pausa de 7 dias). */
export function currentSession<T extends { created_at: string }>(sorted: T[], gapMs: number = APPROACH_SESSION_GAP_MS): T[] {
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (t(sorted[i].created_at) - t(sorted[i - 1].created_at) >= gapMs) start = i;
  }
  return sorted.slice(start);
}

export function stageFor(input: { account: SalesAccount | null; interested: boolean; replied: boolean }): SalesStage {
  const a = input.account;
  if (a) {
    if (a.status === 'ACTIVE' && a.price > 0) return 'CLIENTE';
    if (a.status === 'TRIAL') return 'TESTE';
    return 'CONTA';
  }
  if (input.interested) return 'INTERESSADO';
  return input.replied ? 'RESPONDEU' : 'ABORDADO';
}

export function buildSalesConversation(input: {
  lead: SalesLeadRow;
  /** Mensagens do contato (qualquer ordem). */
  messages: SalesMessage[];
  runs: SalesRun[];
  account: SalesAccount | null;
  business: SalesBusiness | null;
  now: Date;
}): SalesConversation | null {
  const sorted = [...input.messages].sort((a, b) => t(a.created_at) - t(b.created_at));
  const session = currentSession(sorted);
  if (!session.length) return null;
  const startedAt = session[0].created_at;
  const sessionRuns = input.runs.filter((r) => t(r.created_at) >= t(startedAt)).sort((a, b) => t(a.created_at) - t(b.created_at));

  const firstReply = session.find((m) => m.direction === 'INBOUND');
  const replied = Boolean(firstReply);
  const interested = sessionRuns.some((r) => (r.tools || []).includes(SALES_INTEREST_TOOL));

  // Precisa de você: ela chamou e nenhuma mensagem sua veio depois.
  const lastHandoff = [...sessionRuns].reverse().find((r) => (r.tools || []).some((t) => SALES_HANDOFF_TOOLS.includes(t)));
  const yourMessages = session.filter((m) => whoSent(m) === 'VOCE');
  const lastYours = yourMessages[yourMessages.length - 1];
  const needsYou = Boolean(lastHandoff && (!lastYours || t(lastYours.created_at) < t(lastHandoff.created_at)));

  // Estado da vendedora no contato.
  const lead = input.lead;
  let ai: SalesConversation['ai'] = 'ATENDENDO';
  let pausedUntil: string | null = null;
  if (lead.assistant_disabled) ai = 'DESLIGADA';
  else if (lead.assistant_paused_until && t(lead.assistant_paused_until) > input.now.getTime()) {
    ai = 'PAUSADA';
    pausedUntil = lead.assistant_paused_until;
  } else if (firstReply && lastYours && t(lastYours.created_at) > t(firstReply.created_at)) {
    const resumed = lead.assistant_resumed_at ? t(lead.assistant_resumed_at) : 0;
    const until = t(lastYours.created_at) + HUMAN_PAUSE_MS;
    if (t(lastYours.created_at) > resumed && until > input.now.getTime()) {
      ai = 'PAUSADA';
      pausedUntil = new Date(until).toISOString();
    }
  }

  // Último "não respondeu", se veio depois da última resposta dela.
  const lastRun = sessionRuns[sessionRuns.length - 1];
  const bot = session.filter((m) => whoSent(m) === 'VENDEDORA');
  const lastBot = bot[bot.length - 1];
  const lastSkip =
    lastRun && lastRun.status !== 'REPLIED' && lastRun.status !== 'SUPERSEDED' && (!lastBot || t(lastRun.created_at) > t(lastBot.created_at))
      ? {
          status: lastRun.status,
          reason: lastRun.reason,
          label: (lastRun.reason && SALES_SKIP_LABELS[lastRun.reason]) || (lastRun.status === 'FAILED' ? 'Falhou' : 'Não respondeu'),
          at: lastRun.created_at,
        }
      : null;

  const last = session[session.length - 1];
  return {
    leadId: lead.id,
    name: input.business?.name || lead.name || 'Contato',
    phone: lead.phone,
    business: input.business,
    approached: session[0].direction === 'OUTBOUND',
    startedAt,
    lastAt: last.created_at,
    last: { who: whoSent(last), text: String(last.body || '').replace(/\s+/g, ' ').slice(0, 160) },
    messages: session.length,
    stage: stageFor({ account: input.account, interested, replied }),
    interested,
    needsYou,
    ai,
    pausedUntil,
    lastSkip,
  };
}

/** Funil: quantos chegaram pelo menos até cada etapa (só conversas abordadas). */
export function salesFunnel(conversations: SalesConversation[]): Record<SalesStage, number> {
  const out = Object.fromEntries(SALES_STAGES.map((s) => [s, 0])) as Record<SalesStage, number>;
  for (const c of conversations) {
    if (!c.approached) continue;
    const reached = SALES_STAGES.indexOf(c.stage);
    for (let i = 0; i <= reached; i++) out[SALES_STAGES[i]]++;
  }
  return out;
}

/** Ordem da lista: quem precisa de você, depois decididos, depois o mais recente. */
export function sortConversations(list: SalesConversation[]): SalesConversation[] {
  return [...list].sort(
    (a, b) =>
      Number(b.needsYou) - Number(a.needsYou) ||
      Number(b.interested && b.stage === 'INTERESSADO') - Number(a.interested && a.stage === 'INTERESSADO') ||
      t(b.lastAt) - t(a.lastAt)
  );
}

/** Status da prospecção: só avança (Contatado → Respondeu → Interessado → Virou cliente). */
const PROSPECT_RANK: Record<string, number> = { NEW: 0, CONTACTED: 1, REPLIED: 2, INTERESTED: 3, CLIENT: 4 };
export function nextProspectStatus(current: string | null | undefined, target: 'REPLIED' | 'INTERESTED' | 'CLIENT'): string | null {
  const cur = String(current || 'NEW');
  // "Não quer" e "número inválido" foram marcados por você: só virar cliente muda isso.
  if ((cur === 'NOT_INTERESTED' || cur === 'INVALID') && target !== 'CLIENT') return null;
  const rank = PROSPECT_RANK[cur] ?? 0;
  return PROSPECT_RANK[target] > rank ? target : null;
}
