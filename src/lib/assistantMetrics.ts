/**
 * Métricas e monitor da atendente de IA para o /interno (só operação Domu).
 * Lê assistant_runs no período e agrega em memória — volume de um SaaS em
 * começo cabe folgado; quando crescer, trocar por uma view agregada por dia.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  brtDate,
  brtMonthStartIso,
  conversationKeys,
  FLAG_LABELS,
  type AssistantFlag,
  type AssistantRunStatus,
} from '@/lib/assistantUsage';
import { countAssistantConversations } from '@/lib/assistantQuota';
import { getPlanAssistantConversationLimit, getPlanDisplayName, normalizePlanTier } from '@/lib/planLimits';

/** Cotação usada só para exibir em reais. Ajustável sem deploy de código pela env. */
export const USD_BRL = Number(process.env.USD_BRL_RATE) || 5.5;
const MAX_ROWS = 20_000;
const PAGE_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type RunRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  status: AssistantRunStatus;
  reason: string | null;
  model: string | null;
  ai_calls: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cost_usd: number | string;
  cost_usd_full: number | string;
  ai_ms: number | null;
  response_ms: number | null;
  tools: string[] | null;
  tool_errors: number;
  booked: boolean;
  handoff: boolean;
  bubbles: number;
  flags: string[] | null;
  customer_message: string | null;
  reply_text: string | null;
  error: string | null;
  review_status: 'OK' | 'BAD' | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type AssistantRunView = {
  id: string;
  tenantId: string;
  tenantName: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  status: AssistantRunStatus;
  reason: string | null;
  model: string | null;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  /** Preço cheio do modelo (sem promoção). */
  costUsdFull: number;
  aiMs: number | null;
  responseMs: number | null;
  tools: string[];
  booked: boolean;
  handoff: boolean;
  flags: AssistantFlag[];
  customerMessage: string | null;
  replyText: string | null;
  error: string | null;
  reviewStatus: 'OK' | 'BAD' | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  createdAt: string;
};

export type AssistantTotals = {
  runs: number;
  replied: number;
  skipped: number;
  noReply: number;
  failed: number;
  superseded: number;
  conversations: number;
  customers: number;
  bookings: number;
  handoffs: number;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  costUsdFull: number;
  avgAiMs: number | null;
  p95AiMs: number | null;
  avgResponseMs: number | null;
  flagged: number;
  reviewedBad: number;
  reviewedOk: number;
};

export type AssistantTenantStats = {
  tenantId: string;
  tenantName: string;
  runs: number;
  replied: number;
  failed: number;
  noReply: number;
  customers: number;
  bookings: number;
  handoffs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costUsdFull: number;
  /** Projeção de 30 dias no ritmo do período, no preço cheio. */
  projectedMonthUsdFull: number;
  costPerReplyUsdFull: number;
  flagged: number;
  lastRunAt: string | null;
  planName: string;
  /** Cota do mês corrente (não do período filtrado). */
  quotaLimit: number;
  quotaUsed: number;
};

export type AssistantDay = { date: string; runs: number; replied: number; failed: number; costUsd: number; costUsdFull: number };

export type AssistantMetrics = {
  periodDays: number;
  usdBrl: number;
  truncated: boolean;
  totals: AssistantTotals;
  daily: AssistantDay[];
  tenants: AssistantTenantStats[];
  flags: { flag: AssistantFlag; label: string; count: number }[];
  reasons: { status: AssistantRunStatus; reason: string; count: number }[];
  tools: { name: string; count: number }[];
  tenantOptions: { id: string; name: string }[];
};

const num = (v: unknown) => Number(v) || 0;

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

async function tenantNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const { data } = await supabaseAdmin.from('tenants').select('id, name').in('id', ids);
  for (const t of data || []) names.set(t.id, t.name || 'Sem nome');
  return names;
}

export function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

export async function loadAssistantMetrics(opts: { days: number; tenantId?: string | null }): Promise<AssistantMetrics | { missingTable: true }> {
  const since = new Date(Date.now() - opts.days * DAY_MS).toISOString();
  // O PostgREST devolve no máximo 1000 linhas por consulta: lê em páginas até MAX_ROWS.
  const rows: RunRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let query = supabaseAdmin
      .from('assistant_runs')
      .select(
        'id, tenant_id, lead_id, status, reason, ai_calls, input_tokens, output_tokens, cached_tokens, cost_usd, cost_usd_full, ai_ms, response_ms, tools, booked, handoff, flags, review_status, created_at'
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (opts.tenantId) query = query.eq('tenant_id', opts.tenantId);
    const { data, error } = await query;
    if (isMissingTable(error)) return { missingTable: true };
    if (error) throw error;
    rows.push(...((data || []) as RunRow[]));
    if ((data || []).length < PAGE_SIZE) break;
  }

  // Lista do filtro: todo cliente que já usou a IA (não só os do período).
  const { data: allTenants } = await supabaseAdmin
    .from('assistant_settings')
    .select('tenant_id')
    .limit(5000);
  const tenantIds = [...new Set([...rows.map((r) => r.tenant_id), ...(allTenants || []).map((t) => t.tenant_id)])];
  const names = await tenantNames(tenantIds);

  const totals: AssistantTotals = {
    runs: rows.length,
    replied: 0,
    skipped: 0,
    noReply: 0,
    failed: 0,
    superseded: 0,
    conversations: 0,
    customers: 0,
    bookings: 0,
    handoffs: 0,
    aiCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
    costUsdFull: 0,
    avgAiMs: null,
    p95AiMs: null,
    avgResponseMs: null,
    flagged: 0,
    reviewedBad: 0,
    reviewedOk: 0,
  };
  const aiMs: number[] = [];
  const responseMs: number[] = [];
  const customers = new Set<string>();
  const conversations = new Set<string>();
  const byDay = new Map<string, AssistantDay>();
  const byTenant = new Map<string, AssistantTenantStats & { _customers: Set<string> }>();
  const flagCount = new Map<string, number>();
  const reasonCount = new Map<string, { status: AssistantRunStatus; reason: string; count: number }>();
  const toolCount = new Map<string, number>();

  for (let i = 0; i < opts.days; i++) {
    const date = brtDate(new Date(Date.now() - i * DAY_MS).toISOString());
    byDay.set(date, { date, runs: 0, replied: 0, failed: 0, costUsd: 0, costUsdFull: 0 });
  }

  for (const r of rows) {
    const cost = num(r.cost_usd);
    const costFull = num(r.cost_usd_full);
    const flags = r.flags || [];
    const suspicious = flags.some((f) => f !== 'CHAMOU_EQUIPE');
    if (r.status === 'REPLIED') totals.replied++;
    else if (r.status === 'SKIPPED') totals.skipped++;
    else if (r.status === 'NO_REPLY') totals.noReply++;
    else if (r.status === 'FAILED') totals.failed++;
    else if (r.status === 'SUPERSEDED') totals.superseded++;
    if (r.booked) totals.bookings++;
    if (r.handoff) totals.handoffs++;
    totals.aiCalls += num(r.ai_calls);
    totals.inputTokens += num(r.input_tokens);
    totals.outputTokens += num(r.output_tokens);
    totals.cachedTokens += num(r.cached_tokens);
    totals.costUsd += cost;
    totals.costUsdFull += costFull;
    if (suspicious) totals.flagged++;
    if (r.review_status === 'BAD') totals.reviewedBad++;
    if (r.review_status === 'OK') totals.reviewedOk++;
    if (r.ai_ms != null && r.status !== 'SKIPPED') aiMs.push(r.ai_ms);
    if (r.response_ms != null) responseMs.push(r.response_ms);
    if (r.lead_id) {
      customers.add(`${r.tenant_id}:${r.lead_id}`);
      // Conversa = mesmo contato no mesmo dia.
      conversations.add(`${r.tenant_id}:${r.lead_id}:${brtDate(r.created_at)}`);
    }

    const day = byDay.get(brtDate(r.created_at));
    if (day) {
      day.runs++;
      if (r.status === 'REPLIED') day.replied++;
      if (r.status === 'FAILED' || r.status === 'NO_REPLY') day.failed++;
      day.costUsd += cost;
      day.costUsdFull += costFull;
    }

    let t = byTenant.get(r.tenant_id);
    if (!t) {
      t = {
        tenantId: r.tenant_id,
        tenantName: names.get(r.tenant_id) || 'Sem nome',
        runs: 0,
        replied: 0,
        failed: 0,
        noReply: 0,
        customers: 0,
        bookings: 0,
        handoffs: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        costUsdFull: 0,
        projectedMonthUsdFull: 0,
        costPerReplyUsdFull: 0,
        flagged: 0,
        lastRunAt: r.created_at,
        planName: '',
        quotaLimit: 0,
        quotaUsed: 0,
        _customers: new Set(),
      };
      byTenant.set(r.tenant_id, t);
    }
    t.runs++;
    if (r.status === 'REPLIED') t.replied++;
    if (r.status === 'FAILED') t.failed++;
    if (r.status === 'NO_REPLY') t.noReply++;
    if (r.booked) t.bookings++;
    if (r.handoff) t.handoffs++;
    if (suspicious) t.flagged++;
    if (r.lead_id) t._customers.add(r.lead_id);
    t.inputTokens += num(r.input_tokens);
    t.outputTokens += num(r.output_tokens);
    t.costUsd += cost;
    t.costUsdFull += costFull;

    for (const f of flags) flagCount.set(f, (flagCount.get(f) || 0) + 1);
    if (r.reason) {
      const key = `${r.status}|${r.reason}`;
      const cur = reasonCount.get(key) || { status: r.status, reason: r.reason, count: 0 };
      cur.count++;
      reasonCount.set(key, cur);
    }
    for (const tool of r.tools || []) toolCount.set(tool, (toolCount.get(tool) || 0) + 1);
  }

  totals.customers = customers.size;
  totals.conversations = conversations.size;
  totals.avgAiMs = avg(aiMs);
  totals.p95AiMs = percentile(aiMs, 95);
  totals.avgResponseMs = avg(responseMs);

  const quotaIds = [...byTenant.keys()];
  const plans = new Map<string, string | null>();
  let monthCounts = new Map<string, number>();
  if (quotaIds.length) {
    const [subsRes, counts] = await Promise.all([
      supabaseAdmin.from('subscriptions').select('tenant_id, plan_tier').in('tenant_id', quotaIds),
      countAssistantConversations(quotaIds, brtMonthStartIso()),
    ]);
    for (const s of subsRes.data || []) plans.set(s.tenant_id, s.plan_tier);
    monthCounts = counts;
  }

  const tenants: AssistantTenantStats[] = [...byTenant.values()]
    .map(({ _customers, ...t }) => ({
      ...t,
      planName: getPlanDisplayName(normalizePlanTier(plans.get(t.tenantId))),
      quotaLimit: getPlanAssistantConversationLimit(plans.get(t.tenantId)),
      quotaUsed: monthCounts.get(t.tenantId) ?? 0,
      customers: _customers.size,
      projectedMonthUsdFull: (t.costUsdFull / opts.days) * 30,
      costPerReplyUsdFull: t.replied ? t.costUsdFull / t.replied : 0,
    }))
    .sort((a, b) => b.costUsdFull - a.costUsdFull);

  return {
    periodDays: opts.days,
    usdBrl: USD_BRL,
    truncated: rows.length >= MAX_ROWS,
    totals,
    daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    tenants,
    flags: [...flagCount.entries()]
      .map(([flag, count]) => ({ flag: flag as AssistantFlag, label: FLAG_LABELS[flag as AssistantFlag] || flag, count }))
      .sort((a, b) => b.count - a.count),
    reasons: [...reasonCount.values()].sort((a, b) => b.count - a.count),
    tools: [...toolCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    tenantOptions: tenantIds
      .map((id) => ({ id, name: names.get(id) || 'Sem nome' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  };
}

export type RunFilters = {
  days: number;
  tenantId?: string | null;
  status?: AssistantRunStatus | null;
  flag?: AssistantFlag | null;
  review?: 'OK' | 'BAD' | 'PENDING' | null;
  search?: string | null;
  /** Só conversas com problema: falha, sem resposta, marcada errada ou sinal suspeito ainda não revisado. */
  attention?: boolean;
  limit?: number;
};

const ATTENTION_FILTER =
  'status.in.(FAILED,NO_REPLY),review_status.eq.BAD,and(flags.ov.{VALOR_NAO_CADASTRADO,HORARIO_SEM_AGENDA,NAO_SABIA,ERRO_FERRAMENTA},review_status.is.null)';

export async function loadAssistantRuns(filters: RunFilters): Promise<AssistantRunView[]> {
  const since = new Date(Date.now() - filters.days * DAY_MS).toISOString();
  let query = supabaseAdmin
    .from('assistant_runs')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit ?? 100, 300));
  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.flag) query = query.contains('flags', [filters.flag]);
  if (filters.review === 'PENDING') query = query.is('review_status', null);
  else if (filters.review) query = query.eq('review_status', filters.review);
  if (filters.attention) query = query.or(ATTENTION_FILTER);
  if (filters.search?.trim()) {
    const q = filters.search.trim().replace(/[%,()]/g, ' ').slice(0, 80);
    query = query.or(`customer_message.ilike.%${q}%,reply_text.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (isMissingTable(error)) return [];
  if (error) throw error;
  let rows = (data || []) as RunRow[];

  // Com problema numa resposta, traz o resto da conversa do dia para ver o contexto.
  if (filters.attention && rows.length) {
    const keys = conversationKeys(rows);
    const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))] as string[];
    const { data: siblings, error: sibError } = await supabaseAdmin
      .from('assistant_runs')
      .select('*')
      .in('lead_id', leadIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(600);
    if (sibError) throw sibError;
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const s of (siblings || []) as RunRow[]) {
      if (s.lead_id && keys.has(`${s.lead_id}:${brtDate(s.created_at)}`)) byId.set(s.id, s);
    }
    rows = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const names = await tenantNames([...new Set(rows.map((r) => r.tenant_id))]);
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))] as string[];
  const leads = new Map<string, { name: string | null; phone: string | null }>();
  if (leadIds.length) {
    const { data: leadRows } = await supabaseAdmin.from('leads').select('id, name, phone').in('id', leadIds);
    for (const l of leadRows || []) leads.set(l.id, { name: l.name, phone: l.phone });
  }

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: names.get(r.tenant_id) || 'Sem nome',
    leadId: r.lead_id,
    leadName: r.lead_id ? leads.get(r.lead_id)?.name ?? null : null,
    leadPhone: r.lead_id ? leads.get(r.lead_id)?.phone ?? null : null,
    status: r.status,
    reason: r.reason,
    model: r.model,
    aiCalls: num(r.ai_calls),
    inputTokens: num(r.input_tokens),
    outputTokens: num(r.output_tokens),
    costUsdFull: num(r.cost_usd_full),
    aiMs: r.ai_ms,
    responseMs: r.response_ms,
    tools: r.tools || [],
    booked: r.booked,
    handoff: r.handoff,
    flags: (r.flags || []) as AssistantFlag[],
    customerMessage: r.customer_message,
    replyText: r.reply_text,
    error: r.error,
    reviewStatus: r.review_status,
    reviewNote: r.review_note,
    reviewedBy: r.reviewed_by,
    createdAt: r.created_at,
  }));
}

export type ConversationMessage = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: string | null;
  body: string | null;
  createdAt: string;
};

/** Conversa completa de um contato (últimas 200 mensagens) para conferir o contexto. */
export async function loadConversation(tenantId: string, leadId: string): Promise<ConversationMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, direction, sender_type, body, created_at')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || [])
    .reverse()
    .map((m) => ({ id: m.id, direction: m.direction, senderType: m.sender_type, body: m.body, createdAt: m.created_at }));
}

export async function reviewAssistantRun(id: string, review: 'OK' | 'BAD' | null, note: string | null, by: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('assistant_runs')
    .update({
      review_status: review,
      review_note: note?.trim().slice(0, 1000) || null,
      reviewed_by: review ? by : null,
      reviewed_at: review ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return (data?.length || 0) > 0;
}
