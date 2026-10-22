/** Carrega do banco os fatos de cada empresa usados no funil e na lista de risco. */
import { supabaseAdmin } from '@/lib/supabaseServer';
import type { SubscriptionStatus } from '@/lib/platformOverview';
import type { TenantContact, TenantFacts } from '@/lib/platformInsights';

const OWNER_ROLES = ['SUPER_ADMIN', 'ADMIN'];

function keepMax(map: Map<string, string>, key: string, iso: string | null) {
  if (!iso) return;
  const cur = map.get(key);
  if (!cur || iso > cur) map.set(key, iso);
}

function keepMin(map: Map<string, string>, key: string, iso: string | null) {
  if (!iso) return;
  const cur = map.get(key);
  if (!cur || iso < cur) map.set(key, iso);
}

export async function loadTenantFacts(): Promise<TenantFacts[]> {
  const [tenantsRes, usersRes, subsRes, credsRes, campaignsRes, appointmentsRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, name, segment, created_at, whatsapp_number'),
    supabaseAdmin.from('users').select('tenant_id, name, email, phone, role, last_login_at, created_at').limit(10000),
    supabaseAdmin.from('subscriptions').select('tenant_id, status, plan_tier, monthly_price_brl, current_period_end'),
    supabaseAdmin.from('tenant_credentials').select('tenant_id'),
    supabaseAdmin
      .from('campaigns')
      .select('tenant_id, created_at, started_at, sent_count')
      .gt('sent_count', 0)
      .order('created_at', { ascending: false })
      .limit(20000),
    supabaseAdmin
      .from('appointments')
      .select('tenant_id, created_at')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20000),
  ]);
  for (const res of [tenantsRes, usersRes, subsRes, credsRes, campaignsRes]) {
    if (res.error) throw res.error;
  }

  const subs = new Map((subsRes.data || []).map((s) => [s.tenant_id, s]));
  const connected = new Set((credsRes.data || []).map((c) => c.tenant_id));

  const lastLogin = new Map<string, string>();
  const contacts = new Map<string, TenantContact & { owner: boolean; createdAt: string }>();
  for (const u of usersRes.data || []) {
    keepMax(lastLogin, u.tenant_id, u.last_login_at);
    const owner = OWNER_ROLES.includes(String(u.role || '').toUpperCase());
    const cur = contacts.get(u.tenant_id);
    // Contato = dono/administrador mais antigo da empresa.
    if (!cur || (owner && !cur.owner) || (owner === cur.owner && (u.created_at || '') < cur.createdAt)) {
      contacts.set(u.tenant_id, {
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        owner,
        createdAt: u.created_at || '',
      });
    }
  }

  const firstSent = new Map<string, string>();
  const lastCampaign = new Map<string, string>();
  for (const c of campaignsRes.data || []) {
    const at = c.started_at || c.created_at;
    keepMin(firstSent, c.tenant_id, at);
    keepMax(lastCampaign, c.tenant_id, at);
  }

  // Tabela da agenda pode não existir (migration do automotivo não rodou): ignora.
  const lastAppointment = new Map<string, string>();
  if (!appointmentsRes.error) {
    for (const a of appointmentsRes.data || []) keepMax(lastAppointment, a.tenant_id, a.created_at);
  }

  return (tenantsRes.data || []).map((t) => {
    const sub = subs.get(t.id);
    const contact = contacts.get(t.id);
    return {
      tenantId: t.id,
      name: t.name || '—',
      segment: t.segment || 'geral',
      createdAt: t.created_at,
      whatsappConnected: connected.has(t.id),
      subscriptionStatus: ((sub?.status as SubscriptionStatus) || 'NONE') as SubscriptionStatus,
      monthlyPrice: sub?.monthly_price_brl == null ? null : Number(sub.monthly_price_brl),
      planTier: sub?.plan_tier || null,
      periodEnd: sub?.current_period_end || null,
      firstSentAt: firstSent.get(t.id) || null,
      lastCampaignAt: lastCampaign.get(t.id) || null,
      lastLoginAt: lastLogin.get(t.id) || null,
      lastAppointmentAt: lastAppointment.get(t.id) || null,
      contact: contact
        ? { name: contact.name, email: contact.email, phone: contact.phone || t.whatsapp_number || '' }
        : null,
    };
  });
}
