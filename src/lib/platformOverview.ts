import { supabaseAdmin } from '@/lib/supabaseServer';
import { loadOpsAlerts, type OpsAlert } from '@/lib/opsAlert';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIAL'
  | 'PENDING_PAYMENT'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'NONE';

export type TenantOpsRow = {
  tenantId: string;
  name: string;
  segment: string;
  tenantStatus: string;
  createdAt: string;
  planTier: string | null;
  subscriptionStatus: SubscriptionStatus;
  paymentMethod: string | null;
  monthlyPrice: number | null;
  periodEnd: string | null;
};

export type PlatformOverview = {
  generatedAt: string;
  totals: {
    tenants: number;
    users: number;
    paying: number;
    trial: number;
    pendingPayment: number;
    pastDue: number;
    canceled: number;
    noSubscription: number;
  };
  campaigns7d: {
    total: number;
    scheduled: number;
    running: number;
    failed: number;
    completed: number;
  };
  tenants: TenantOpsRow[];
  alerts: OpsAlert[];
};

function statusOf(raw: string | null | undefined): SubscriptionStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'TRIAL' || s === 'PENDING_PAYMENT' || s === 'PAST_DUE' || s === 'CANCELED') {
    return s;
  }
  return 'NONE';
}

export async function loadPlatformOverview(): Promise<PlatformOverview> {
  const [{ data: tenants, error: tenantErr }, { count: userCount }, { data: subs }, { data: campaigns }] =
    await Promise.all([
      supabaseAdmin
        .from('tenants')
        .select('id, name, segment, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('subscriptions')
        .select('tenant_id, status, plan_tier, monthly_price_brl, payment_method, current_period_end'),
      supabaseAdmin
        .from('campaigns')
        .select('status')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(2000),
    ]);

  if (tenantErr) throw tenantErr;

  type SubRow = {
    tenant_id: string;
    status: string | null;
    plan_tier: string | null;
    monthly_price_brl: number | null;
    payment_method: string | null;
    current_period_end: string | null;
  };
  const subByTenant = new Map<string, SubRow>();
  for (const row of (subs || []) as SubRow[]) {
    subByTenant.set(row.tenant_id, row);
  }

  const rows: TenantOpsRow[] = (tenants || []).map((t) => {
    const sub = subByTenant.get(t.id);
    return {
      tenantId: t.id,
      name: t.name,
      segment: t.segment || 'geral',
      tenantStatus: t.status || 'ACTIVE',
      createdAt: t.created_at,
      planTier: sub?.plan_tier || null,
      subscriptionStatus: statusOf(sub?.status),
      paymentMethod: sub?.payment_method || null,
      monthlyPrice: sub?.monthly_price_brl != null ? Number(sub.monthly_price_brl) : null,
      periodEnd: sub?.current_period_end || null,
    };
  });

  const totals = {
    tenants: rows.length,
    users: userCount || 0,
    paying: 0,
    trial: 0,
    pendingPayment: 0,
    pastDue: 0,
    canceled: 0,
    noSubscription: 0,
  };

  for (const row of rows) {
    if (row.subscriptionStatus === 'ACTIVE') totals.paying += 1;
    else if (row.subscriptionStatus === 'TRIAL') totals.trial += 1;
    else if (row.subscriptionStatus === 'PENDING_PAYMENT') totals.pendingPayment += 1;
    else if (row.subscriptionStatus === 'PAST_DUE') totals.pastDue += 1;
    else if (row.subscriptionStatus === 'CANCELED') totals.canceled += 1;
    else totals.noSubscription += 1;
  }

  const campaigns7d = { total: 0, scheduled: 0, running: 0, failed: 0, completed: 0 };
  for (const c of campaigns || []) {
    campaigns7d.total += 1;
    const st = String(c.status || '').toUpperCase();
    if (st === 'SCHEDULED') campaigns7d.scheduled += 1;
    else if (st === 'RUNNING') campaigns7d.running += 1;
    else if (st === 'FAILED') campaigns7d.failed += 1;
    else if (st === 'COMPLETED') campaigns7d.completed += 1;
  }

  const alerts = await loadOpsAlerts(40);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    campaigns7d,
    tenants: rows,
    alerts,
  };
}
