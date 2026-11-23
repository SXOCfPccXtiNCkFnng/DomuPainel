/**
 * Dados da aba Vendedora do /interno: as conversas da conta de vendas
 * (DOMU_SALES_TENANT_ID) com etapa do funil, estado da vendedora e o
 * estabelecimento da prospecção. Também mantém o status da prospecção em dia.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { HUMAN_PAUSE_MS } from '@/lib/assistantRules';
import { isPlatformAdminEmail } from '@/lib/platformAdmin';
import { phoneLookupVariants } from '@/lib/phone';
import { phoneKey, PROSPECT_KINDS } from '@/lib/prospectRules';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import { isSalesAgentEnabled, salesTenantId } from '@/lib/salesAgent';
import type { TenantSegment } from '@/types';
import {
  buildSalesConversation,
  nextProspectStatus,
  salesFunnel,
  sortConversations,
  whoSent,
  type SalesAccount,
  type SalesBusiness,
  type SalesConversation,
  type SalesLeadRow,
  type SalesMessage,
  type SalesRun,
  type SalesStage,
  type SalesWho,
} from '@/lib/salesMonitorRules';

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function paged<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { code?: string } | null }>, max: number): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return rows;
      throw error;
    }
    const page = (data as T[]) || [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type ProspectRow = { id: string; name: string; kind: string; module: string; city: string | null; phone: string | null; phone_intl: string | null; status: string };

function businessOf(p: ProspectRow): SalesBusiness {
  return {
    name: p.name,
    kind: PROSPECT_KINDS.find((k) => k.id === p.kind)?.label || p.kind,
    module: SEGMENT_LABELS[p.module as TenantSegment] || p.module,
    city: p.city,
  };
}

async function loadLeads(tenantId: string, ids: string[]): Promise<SalesLeadRow[]> {
  const out: SalesLeadRow[] = [];
  for (const part of chunks(ids, 200)) {
    const full = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, assistant_paused_until, assistant_disabled, assistant_resumed_at')
      .eq('tenant_id', tenantId)
      .in('id', part);
    if (full.error?.code === '42703') {
      const basic = await supabaseAdmin.from('leads').select('id, name, phone, assistant_paused_until').eq('tenant_id', tenantId).in('id', part);
      out.push(...((basic.data || []) as SalesLeadRow[]));
    } else {
      if (full.error) throw full.error;
      out.push(...((full.data || []) as SalesLeadRow[]));
    }
  }
  return out;
}

/** Conta na Domu de cada telefone (outra empresa, fora contas de teste do /interno). */
async function loadAccounts(tenantId: string, phones: string[]): Promise<Map<string, SalesAccount>> {
  const byKey = new Map<string, SalesAccount>();
  const variants = [...new Set(phones.flatMap((p) => phoneLookupVariants(p)))];
  const users: { tenant_id: string; email: string | null; phone: string | null }[] = [];
  for (const part of chunks(variants, 300)) {
    const { data } = await supabaseAdmin.from('users').select('tenant_id, email, phone').in('phone', part).neq('tenant_id', tenantId);
    users.push(...((data || []) as typeof users));
  }
  const real = users.filter((u) => !isPlatformAdminEmail(u.email));
  if (!real.length) return byKey;
  const subs = new Map<string, SalesAccount>();
  for (const part of chunks([...new Set(real.map((u) => u.tenant_id))], 200)) {
    const { data } = await supabaseAdmin.from('subscriptions').select('tenant_id, status, monthly_price_brl').in('tenant_id', part);
    for (const s of data || []) subs.set(s.tenant_id, { status: s.status ?? null, price: Number(s.monthly_price_brl || 0) });
  }
  const rank = (a: SalesAccount) => (a.status === 'ACTIVE' && a.price > 0 ? 3 : a.status === 'TRIAL' ? 2 : 1);
  for (const u of real) {
    const key = phoneKey(u.phone);
    if (!key) continue;
    const account = subs.get(u.tenant_id) || { status: null, price: 0 };
    const current = byKey.get(key);
    if (!current || rank(account) > rank(current)) byKey.set(key, account);
  }
  return byKey;
}

async function loadProspectsByKey(): Promise<Map<string, ProspectRow>> {
  const rows = await paged<ProspectRow>(
    (from, to) =>
      supabaseAdmin
        .from('prospects')
        .select('id, name, kind, module, city, phone, phone_intl, status')
        .neq('status', 'NEW')
        .range(from, to),
    20_000
  );
  const map = new Map<string, ProspectRow>();
  for (const p of rows) {
    const key = phoneKey(p.phone_intl) || phoneKey(p.phone);
    if (key) map.set(key, p);
  }
  return map;
}

export type SalesMonitorData =
  | { configured: false }
  | {
      configured: true;
      enabled: boolean;
      days: number;
      conversations: SalesConversation[];
      funnel: Record<SalesStage, number>;
      unapproached: number;
    };

export async function loadSalesMonitor(days: number, now: Date = new Date()): Promise<SalesMonitorData> {
  const tenantId = salesTenantId();
  if (!tenantId) return { configured: false };
  const since = new Date(now.getTime() - days * DAY_MS);
  // Uma semana antes do período para achar o começo das conversas que entram nele.
  const from = new Date(since.getTime() - 7 * DAY_MS).toISOString();

  const [enabled, messages, runs, prospects] = await Promise.all([
    isSalesAgentEnabled(),
    paged<SalesMessage & { lead_id: string }>(
      (a, b) =>
        supabaseAdmin
          .from('chat_messages')
          .select('lead_id, direction, sender_type, body, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', from)
          .order('created_at', { ascending: true })
          .range(a, b),
      30_000
    ),
    paged<SalesRun & { lead_id: string }>(
      (a, b) =>
        supabaseAdmin
          .from('assistant_runs')
          .select('lead_id, status, reason, tools, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', from)
          .range(a, b),
      30_000
    ),
    loadProspectsByKey(),
  ]);

  const byLead = new Map<string, SalesMessage[]>();
  for (const m of messages) {
    if (!m.lead_id) continue;
    (byLead.get(m.lead_id) || byLead.set(m.lead_id, []).get(m.lead_id)!).push(m);
  }
  const active = [...byLead.entries()].filter(([, list]) => new Date(list[list.length - 1].created_at) >= since).map(([id]) => id);
  const runsByLead = new Map<string, SalesRun[]>();
  for (const r of runs) (runsByLead.get(r.lead_id) || runsByLead.set(r.lead_id, []).get(r.lead_id)!).push(r);

  const leads = await loadLeads(tenantId, active);
  const accounts = await loadAccounts(tenantId, leads.map((l) => l.phone));

  const conversations: SalesConversation[] = [];
  for (const lead of leads) {
    const key = phoneKey(lead.phone);
    const prospect = key ? prospects.get(key) : undefined;
    const conv = buildSalesConversation({
      lead,
      messages: byLead.get(lead.id) || [],
      runs: runsByLead.get(lead.id) || [],
      account: key ? accounts.get(key) ?? null : null,
      business: prospect ? businessOf(prospect) : null,
      now,
    });
    if (conv) conversations.push(conv);
  }

  return {
    configured: true,
    enabled,
    days,
    conversations: sortConversations(conversations),
    funnel: salesFunnel(conversations),
    unapproached: conversations.filter((c) => !c.approached).length,
  };
}

export type SalesChatMessage = { who: SalesWho; text: string; at: string };
export type SalesChat = {
  messages: SalesChatMessage[];
  runs: { status: string; reason: string | null; tools: string[]; at: string }[];
};

/** Conversa inteira de um contato da conta de vendas (últimas 200 mensagens). */
export async function loadSalesChat(leadId: string): Promise<SalesChat | null> {
  const tenantId = salesTenantId();
  if (!tenantId) return null;
  const [msgRes, runRes] = await Promise.all([
    supabaseAdmin
      .from('chat_messages')
      .select('direction, sender_type, body, created_at')
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('assistant_runs')
      .select('status, reason, tools, created_at')
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (msgRes.error) throw msgRes.error;
  return {
    messages: ((msgRes.data || []) as SalesMessage[])
      .reverse()
      .map((m) => ({ who: whoSent(m), text: String(m.body || ''), at: m.created_at })),
    runs: ((runRes.data || []) as SalesRun[]).reverse().map((r) => ({ status: r.status, reason: r.reason, tools: r.tools || [], at: r.created_at })),
  };
}

export type SalesLeadAction = 'pause' | 'resume' | 'disable' | 'enable';

/** Pausar (12h), devolver para a vendedora, ou desligar/ligar só neste contato. */
export async function setSalesLeadAssistant(leadId: string, action: SalesLeadAction): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = salesTenantId();
  if (!tenantId) return { ok: false, error: 'Vendedora não configurada.' };
  const now = new Date();
  const update: Record<string, unknown> =
    action === 'pause'
      ? { assistant_paused_until: new Date(now.getTime() + HUMAN_PAUSE_MS).toISOString() }
      : action === 'resume'
        ? { assistant_paused_until: null, assistant_resumed_at: now.toISOString() }
        : { assistant_disabled: action === 'disable' };
  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ ...update, updated_at: now.toISOString() })
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .select('id');
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      return { ok: false, error: 'Rode a migration 20261022_lead_assistant_control.sql para usar essa ação.' };
    }
    throw error;
  }
  if (!data?.length) return { ok: false, error: 'Contato não encontrado.' };
  return { ok: true };
}

/**
 * Atualiza o status do estabelecimento na prospecção pelo telefone (só avança:
 * Contatado → Respondeu → Interessado → Virou cliente). Nunca lança.
 */
export async function syncProspectStatus(phone: string | null | undefined, target: 'REPLIED' | 'INTERESTED' | 'CLIENT'): Promise<void> {
  try {
    const key = phoneKey(phone);
    if (!key) return;
    const { data } = await supabaseAdmin
      .from('prospects')
      .select('id, status, phone, phone_intl')
      .or(`phone.ilike.%${key.slice(-4)}%,phone_intl.ilike.%${key.slice(-4)}%`)
      .limit(50);
    const row = (data || []).find((p) => phoneKey(p.phone_intl) === key || phoneKey(p.phone) === key);
    if (!row) return;
    const next = nextProspectStatus(row.status, target);
    if (!next) return;
    await supabaseAdmin.from('prospects').update({ status: next }).eq('id', row.id);
  } catch (err) {
    logger.warn('sales.prospect_sync_failed', { target, message: err instanceof Error ? err.message : String(err) });
  }
}
