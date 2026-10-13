import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlatformAdminEmails } from '@/lib/platformAdmin';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendEmail, appBaseUrl } from '@/lib/email';
import { escapeHtml } from '@/lib/emailTemplates';

export type OpsAlert = {
  id: string;
  source: string;
  level: 'error' | 'warn';
  message: string;
  tenantId: string | null;
  tenantName?: string | null;
  createdAt: string;
  lastSeenAt: string;
  occurrences: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  meta: Record<string, unknown>;
};

/** No máx. 1 e-mail por origem a cada 30 min — evita spam quando um erro se repete. */
const ALERT_EMAIL_WINDOW_MS = 30 * 60 * 1000;
/** Mesmo erro aberto dentro desse intervalo soma no contador em vez de criar linha nova. */
const GROUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY = /token|secret|password|senha|authorization|api[_-]?key|cookie|pin/i;

/**
 * Identidade do erro para agrupar: origem + mensagem sem as partes que mudam a
 * cada ocorrência (ids, números, wamids), para "falhou para o tenant X" e
 * "falhou para o tenant Y" virarem a mesma linha.
 */
export function fingerprintOf(source: string, message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/wamid\.[a-z0-9=_-]+/g, '<wamid>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
  return crypto.createHash('sha1').update(`${source}|${normalized}`).digest('hex').slice(0, 40);
}

/** Tira tokens/senhas e corta textos longos antes de gravar os detalhes. */
export function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!meta) return out;
  for (const [key, value] of Object.entries(meta).slice(0, 25)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[oculto]';
      continue;
    }
    if (typeof value === 'string') out[key] = value.slice(0, 800);
    else if (typeof value === 'number' || typeof value === 'boolean' || value == null) out[key] = value;
    else {
      try {
        out[key] = JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'string' ? v.slice(0, 300) : v)));
      } catch {
        out[key] = String(value).slice(0, 300);
      }
    }
  }
  return out;
}

/**
 * Grava um erro/aviso no painel /interno, agrupando repetições. Nunca lança:
 * registrar erro não pode virar outro erro no fluxo principal.
 */
export async function recordOpsEvent(input: {
  source: string;
  message: string;
  level?: 'error' | 'warn';
  tenantId?: string | null;
  meta?: Record<string, unknown>;
  count?: number;
}): Promise<void> {
  try {
    const source = input.source.slice(0, 80);
    const message = String(input.message || 'Erro').slice(0, 2000);
    const level = input.level || 'error';
    const tenantId = input.tenantId && UUID_RE.test(input.tenantId) ? input.tenantId : null;
    const meta = sanitizeMeta(input.meta);
    const count = Math.max(1, input.count || 1);
    const fingerprint = fingerprintOf(source, message);
    const nowIso = new Date().toISOString();

    const { data: open, error: findError } = await supabaseAdmin
      .from('ops_alerts')
      .select('id, occurrences')
      .eq('fingerprint', fingerprint)
      .is('resolved_at', null)
      .gte('last_seen_at', new Date(Date.now() - GROUP_WINDOW_MS).toISOString())
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Migration de observabilidade ainda não aplicada: grava no formato antigo.
    if (findError?.code === '42703') {
      await supabaseAdmin.from('ops_alerts').insert({ source, level, message, tenant_id: tenantId, meta });
      return;
    }

    if (open) {
      await supabaseAdmin
        .from('ops_alerts')
        .update({
          occurrences: Number(open.occurrences || 1) + count,
          last_seen_at: nowIso,
          message,
          meta,
          level,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        })
        .eq('id', open.id);
      return;
    }

    await supabaseAdmin.from('ops_alerts').insert({
      source,
      level,
      message,
      tenant_id: tenantId,
      meta,
      fingerprint,
      occurrences: count,
      last_seen_at: nowIso,
    });
  } catch (err) {
    // console direto (não logger): o logger grava aqui, e isso viraria um laço.
    console.error('[opsAlert] falha ao gravar alerta', err instanceof Error ? err.message : err);
  }
}

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
  const html = `<p><strong>Origem:</strong> ${escapeHtml(input.source)}</p>${
    input.tenantId ? `<p><strong>Tenant:</strong> ${escapeHtml(input.tenantId)}</p>` : ''
  }<p><strong>Mensagem:</strong> ${escapeHtml(input.message)}</p><p><a href="${dashboardUrl}">Ver painel /interno</a></p>`;

  try {
    await Promise.all(admins.map((to) => sendEmail({ to, subject, text, html })));
  } catch (err) {
    console.error('[opsAlert] e-mail de alerta falhou', err instanceof Error ? err.message : err);
  }
}

/** Erro que merece atenção da equipe: grava no painel e (se for erro) avisa por e-mail. */
export async function logOpsAlert(input: {
  source: string;
  message: string;
  level?: 'error' | 'warn';
  tenantId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await recordOpsEvent(input);
  if ((input.level || 'error') === 'error') {
    await notifyPlatformAdmins({
      source: input.source,
      message: input.message,
      tenantId: input.tenantId,
    });
  }
}

export async function resolveOpsAlert(id: string, by: string, resolved = true): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('ops_alerts')
    .update(resolved ? { resolved_at: new Date().toISOString(), resolved_by: by } : { resolved_at: null, resolved_by: null })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return (data?.length || 0) > 0;
}

/** Resolve de uma vez todos os abertos de uma origem (ex.: depois de corrigir o bug). */
export async function resolveOpsAlertsBySource(source: string, by: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('ops_alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: by })
    .eq('source', source)
    .is('resolved_at', null)
    .select('id');
  if (error) throw error;
  return data?.length || 0;
}

export async function loadOpsAlerts(options?: {
  limit?: number;
  status?: 'open' | 'resolved' | 'all';
  level?: 'error' | 'warn' | 'all';
  source?: string | null;
  tenantId?: string | null;
}): Promise<OpsAlert[]> {
  const limit = options?.limit ?? 100;
  const build = (withGrouping: boolean) => {
    let query = supabaseAdmin
      .from('ops_alerts')
      .select(
        withGrouping
          ? 'id, source, level, message, tenant_id, created_at, last_seen_at, occurrences, resolved_at, resolved_by, meta'
          : 'id, source, level, message, tenant_id, created_at, meta'
      )
      .order(withGrouping ? 'last_seen_at' : 'created_at', { ascending: false })
      .limit(limit);
    if (withGrouping && options?.status === 'open') query = query.is('resolved_at', null);
    if (withGrouping && options?.status === 'resolved') query = query.not('resolved_at', 'is', null);
    if (options?.level && options.level !== 'all') query = query.eq('level', options.level);
    if (options?.source) query = query.eq('source', options.source);
    if (options?.tenantId) query = query.eq('tenant_id', options.tenantId);
    return query;
  };

  let res = await build(true);
  if (res.error?.code === '42703') res = await build(false);
  if (res.error) return [];

  const rows = (res.data || []) as any[];
  const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id, name').in('id', tenantIds);
    for (const t of tenants || []) names.set(t.id, t.name);
  }

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    level: row.level === 'warn' ? 'warn' : 'error',
    message: row.message,
    tenantId: row.tenant_id,
    tenantName: row.tenant_id ? names.get(row.tenant_id) || null : null,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at || row.created_at,
    occurrences: Number(row.occurrences || 1),
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
    meta: (row.meta as Record<string, unknown>) || {},
  }));
}
