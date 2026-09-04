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

export type OverdueCampaign = {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string | null;
  scheduledAt: string;
  minutesLate: number;
};

export type ExpiringSubscription = {
  tenantId: string;
  tenantName: string | null;
  planTier: string | null;
  periodEnd: string;
  daysLeft: number;
};

export type ErrorSourceStat = {
  source: string;
  count24h: number;
  count7d: number;
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
  delivery7d: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    deliveryRatePercent: number | null;
  };
  growth: {
    signups7d: number;
    signups30d: number;
  };
  mrr: number;
  cronHealth: {
    overdueCount: number;
    overdueCampaigns: OverdueCampaign[];
  };
  expiringSoon: ExpiringSubscription[];
  errorsBySource: ErrorSourceStat[];
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
  const nowIso = new Date().toISOString();
  const in3DaysIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: tenants, error: tenantErr },
    { count: userCount },
    { data: subs },
    { data: campaigns },
    { data: overdue },
  ] = await Promise.all([
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
      .select('status, sent_count, delivered_count, read_count, failed_count')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(2000),
    supabaseAdmin
      .from('campaigns')
      .select('id, name, tenant_id, scheduled_at')
      .eq('status', 'SCHEDULED')
      .lt('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(50),
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
  const delivery7d = { sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const c of (campaigns || []) as any[]) {
    campaigns7d.total += 1;
    const st = String(c.status || '').toUpperCase();
    if (st === 'SCHEDULED') campaigns7d.scheduled += 1;
    else if (st === 'RUNNING') campaigns7d.running += 1;
    else if (st === 'FAILED') campaigns7d.failed += 1;
    else if (st === 'COMPLETED') campaigns7d.completed += 1;

    delivery7d.sent += Number(c.sent_count || 0);
    delivery7d.delivered += Number(c.delivered_count || 0);
    delivery7d.read += Number(c.read_count || 0);
    delivery7d.failed += Number(c.failed_count || 0);
  }
  const deliveryRatePercent =
    delivery7d.sent > 0 ? Math.round((delivery7d.delivered / delivery7d.sent) * 1000) / 10 : null;

  const tenantNameById = new Map(rows.map((r) => [r.tenantId, r.name]));

  const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const growth = {
    signups7d: rows.filter((r) => new Date(r.createdAt).getTime() >= since7d).length,
    signups30d: rows.filter((r) => new Date(r.createdAt).getTime() >= since30d).length,
  };

  const mrr = ((subs || []) as SubRow[])
    .filter((s) => statusOf(s.status) === 'ACTIVE')
    .reduce((sum, s) => sum + Number(s.monthly_price_brl || 0), 0);

  const overdueCampaigns: OverdueCampaign[] = ((overdue || []) as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    tenantId: c.tenant_id,
    tenantName: tenantNameById.get(c.tenant_id) || null,
    scheduledAt: c.scheduled_at,
    minutesLate: Math.max(0, Math.round((Date.now() - new Date(c.scheduled_at).getTime()) / 60000)),
  }));

  const expiringSoon: ExpiringSubscription[] = ((subs || []) as SubRow[])
    .filter(
      (s) =>
        statusOf(s.status) === 'ACTIVE' &&
        s.current_period_end &&
        s.current_period_end >= nowIso &&
        s.current_period_end <= in3DaysIso
    )
    .map((s) => ({
      tenantId: s.tenant_id,
      tenantName: tenantNameById.get(s.tenant_id) || null,
      planTier: s.plan_tier,
      periodEnd: s.current_period_end as string,
      daysLeft: Math.max(
        0,
        Math.ceil((new Date(s.current_period_end as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      ),
    }))
    .sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());

  const alerts = await loadOpsAlerts(40);

  const errorStatsBySource = new Map<string, ErrorSourceStat>();
  const since24hMs = Date.now() - 24 * 60 * 60 * 1000;
  const since7dMs = since7d;
  for (const a of alerts) {
    const key = a.source || 'outro';
    if (!errorStatsBySource.has(key)) {
      errorStatsBySource.set(key, { source: key, count24h: 0, count7d: 0 });
    }
    const stat = errorStatsBySource.get(key)!;
    const t = new Date(a.createdAt).getTime();
    if (t >= since7dMs) stat.count7d += 1;
    if (t >= since24hMs) stat.count24h += 1;
  }
  const errorsBySource = Array.from(errorStatsBySource.values()).sort((a, b) => b.count7d - a.count7d);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    campaigns7d,
    delivery7d: { ...delivery7d, deliveryRatePercent },
    growth,
    mrr,
    cronHealth: { overdueCount: overdueCampaigns.length, overdueCampaigns },
    expiringSoon,
    errorsBySource,
    tenants: rows,
    alerts,
  };
}
