import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlatformAdminEmails } from '@/lib/platformAdmin';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendEmail, appBaseUrl } from '@/lib/email';
import { logger } from '@/lib/logger';

export type OpsAlert = {
  id: string;
  source: string;
  level: 'error' | 'warn';
  message: string;
  tenantId: string | null;
  tenantName?: string | null;
  createdAt: string;
};

/** No máx. 1 e-mail por origem a cada 30 min — evita spam quando um erro se repete. */
const ALERT_EMAIL_WINDOW_MS = 30 * 60 * 1000;

async function notifyPlatformAdmins(input: { source: string; message: string; tenantId?: string | null }) {
  const admins = getPlatformAdminEmails();
  if (admins.length === 0) return;

  const limit = checkRateLimit(`opsalert:email:${input.source}`, 1, ALERT_EMAIL_WINDOW_MS);
  if (!limit.ok) return;

  const dashboardUrl = `${appBaseUrl()}/interno`;
  const subject = `[Domu Tech] Erro em ${input.source}`;
  const text = `Origem: ${input.source}\n${
    input.tenantId ? `Tenant: ${input.tenantId}\n` : ''
  }\nMensagem: ${input.message}\n\nVeja detalhes: ${dashboardUrl}`;
  const html = `<p><strong>Origem:</strong> ${input.source}</p>${
    input.tenantId ? `<p><strong>Tenant:</strong> ${input.tenantId}</p>` : ''
  }<p><strong>Mensagem:</strong> ${input.message}</p><p><a href="${dashboardUrl}">Ver painel /interno</a></p>`;

  try {
    await Promise.all(admins.map((to) => sendEmail({ to, subject, text, html })));
  } catch (err) {
    logger.error('opsalert.email_failed', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function logOpsAlert(input: {
  source: string;
  message: string;
  level?: 'error' | 'warn';
  tenantId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from('ops_alerts').insert({
      source: input.source.slice(0, 80),
      level: input.level || 'error',
      message: String(input.message || 'Erro').slice(0, 2000),
      tenant_id: input.tenantId || null,
      meta: input.meta || {},
    });
  } catch {
    // Tabela ainda não migrada — não quebrar o fluxo principal.
  }

  if ((input.level || 'error') === 'error') {
    await notifyPlatformAdmins({
      source: input.source,
      message: input.message,
      tenantId: input.tenantId,
    });
  }
}

export async function loadOpsAlerts(limit = 40): Promise<OpsAlert[]> {
  const alerts: OpsAlert[] = [];

  const stored = await supabaseAdmin
    .from('ops_alerts')
    .select('id, source, level, message, tenant_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!stored.error && stored.data) {
    for (const row of stored.data) {
      alerts.push({
        id: row.id,
        source: row.source,
        level: row.level === 'warn' ? 'warn' : 'error',
        message: row.message,
        tenantId: row.tenant_id,
        createdAt: row.created_at,
      });
    }
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: failedCamps }, { data: failedLogs }] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id, name, tenant_id, updated_at')
      .eq('status', 'FAILED')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('campaign_logs')
      .select('id, error_message, tenant_id, created_at, campaigns(name)')
      .eq('status', 'FAILED')
      .not('error_message', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  for (const camp of failedCamps || []) {
    alerts.push({
      id: `camp:${camp.id}`,
      source: 'campanha',
      level: 'error',
      message: `Campanha falhou: ${camp.name || camp.id}`,
      tenantId: camp.tenant_id,
      createdAt: camp.updated_at,
    });
  }

  for (const log of failedLogs || []) {
    const campName = (log as { campaigns?: { name?: string } | null }).campaigns?.name;
    alerts.push({
      id: `log:${log.id}`,
      source: 'envio',
      level: 'error',
      message: `${campName ? `[${campName}] ` : ''}${log.error_message}`,
      tenantId: log.tenant_id,
      createdAt: log.created_at,
    });
  }

  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const seen = new Set<string>();
  const unique: OpsAlert[] = [];
  for (const a of alerts) {
    const key = `${a.source}|${a.message}|${a.tenantId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(a);
    if (unique.length >= limit) break;
  }

  const tenantIds = [...new Set(unique.map((a) => a.tenantId).filter(Boolean))] as string[];
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id, name').in('id', tenantIds);
    const names = new Map((tenants || []).map((t) => [t.id, t.name]));
    for (const a of unique) {
      if (a.tenantId) a.tenantName = names.get(a.tenantId) || null;
    }
  }

  return unique;
}
