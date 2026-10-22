/**
 * Pessoas cadastradas na plataforma (painel /interno): quem é, de qual
 * empresa, se está pagando e quando entrou pela última vez.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import type { SubscriptionStatus } from '@/lib/platformOverview';

/** Situação de pagamento como a operação enxerga (cortesia = ativa sem cobrança). */
export type PaymentState = 'PAYING' | 'COURTESY' | 'TRIAL' | 'PENDING' | 'PAST_DUE' | 'CANCELED' | 'NONE';

export type PlatformUserRow = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  tenantId: string;
  companyName: string;
  segment: string;
  subscriptionStatus: SubscriptionStatus;
  paymentState: PaymentState;
  planTier: string | null;
  monthlyPrice: number | null;
  periodEnd: string | null;
};

export type PlatformUsersSummary = {
  total: number;
  login24h: number;
  login7d: number;
  inactive30d: number;
  neverLogged: number;
  paying: number;
  courtesy: number;
  notPaying: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_USERS = 5000;

export function paymentStateOf(status: SubscriptionStatus, monthlyPrice: number | null): PaymentState {
  switch (status) {
    case 'ACTIVE':
      return monthlyPrice != null && monthlyPrice > 0 ? 'PAYING' : 'COURTESY';
    case 'TRIAL':
      return 'TRIAL';
    case 'PENDING_PAYMENT':
      return 'PENDING';
    case 'PAST_DUE':
      return 'PAST_DUE';
    case 'CANCELED':
      return 'CANCELED';
    default:
      return 'NONE';
  }
}

export function summarizeUsers(rows: PlatformUserRow[], now = Date.now()): PlatformUsersSummary {
  const since = (iso: string | null) => (iso ? now - new Date(iso).getTime() : Infinity);
  return {
    total: rows.length,
    login24h: rows.filter((r) => since(r.lastLoginAt) <= DAY_MS).length,
    login7d: rows.filter((r) => since(r.lastLoginAt) <= 7 * DAY_MS).length,
    inactive30d: rows.filter((r) => r.lastLoginAt && since(r.lastLoginAt) > 30 * DAY_MS).length,
    neverLogged: rows.filter((r) => !r.lastLoginAt).length,
    paying: rows.filter((r) => r.paymentState === 'PAYING').length,
    courtesy: rows.filter((r) => r.paymentState === 'COURTESY').length,
    notPaying: rows.filter((r) => !['PAYING', 'COURTESY', 'TRIAL'].includes(r.paymentState)).length,
  };
}

export async function loadPlatformUsers(): Promise<{ users: PlatformUserRow[]; summary: PlatformUsersSummary }> {
  const [usersRes, tenantsRes, subsRes] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, tenant_id, name, email, phone, role, last_login_at, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_USERS),
    supabaseAdmin.from('tenants').select('id, name, segment, whatsapp_number'),
    supabaseAdmin
      .from('subscriptions')
      .select('tenant_id, status, plan_tier, monthly_price_brl, current_period_end'),
  ]);
  if (usersRes.error) throw usersRes.error;
  if (tenantsRes.error) throw tenantsRes.error;
  if (subsRes.error) throw subsRes.error;

  const tenants = new Map((tenantsRes.data || []).map((t) => [t.id, t]));
  const subs = new Map((subsRes.data || []).map((s) => [s.tenant_id, s]));

  const users: PlatformUserRow[] = (usersRes.data || []).map((u) => {
    const tenant = tenants.get(u.tenant_id);
    const sub = subs.get(u.tenant_id);
    const status = ((sub?.status as SubscriptionStatus) || 'NONE') as SubscriptionStatus;
    const price = sub?.monthly_price_brl == null ? null : Number(sub.monthly_price_brl);
    return {
      userId: u.id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || tenant?.whatsapp_number || '',
      role: String(u.role || 'ADMIN').toUpperCase(),
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      tenantId: u.tenant_id,
      companyName: tenant?.name || '—',
      segment: tenant?.segment || 'geral',
      subscriptionStatus: status,
      paymentState: paymentStateOf(status, price),
      planTier: sub?.plan_tier || null,
      monthlyPrice: price,
      periodEnd: sub?.current_period_end || null,
    };
  });

  return { users, summary: summarizeUsers(users) };
}
