import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlatformAdminEmails } from '@/lib/platformAdmin';
import { checkRateLimit } from '@/lib/rateLimit';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { sendEmail, appBaseUrl } from '@/lib/email';
import { brandedEmailHtml, escapeHtml } from '@/lib/emailTemplates';

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
/** Teto de e-mails de erro novo por hora (uma avalanche de erros diferentes não vira 200 e-mails). */
const NEW_ERROR_EMAILS_PER_HOUR = 20;
/** Erros do próprio envio de e-mail não geram e-mail (seria um laço). */
const NO_EMAIL_SOURCES = /^email\./;
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
}): Promise<{ created: boolean }> {
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
      return { created: false };
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
      return { created: false };
    }

    const { error: insertError } = await supabaseAdmin.from('ops_alerts').insert({
      source,
      level,
      message,
      tenant_id: tenantId,
      meta,
      fingerprint,
      occurrences: count,
      last_seen_at: nowIso,
    });
    if (insertError) throw insertError;

    // Erro novo (ou que voltou depois de resolvido): avisa a operação por e-mail.
    // Repetições do mesmo erro só somam no contador, sem novo e-mail.
    if (level === 'error' && !NO_EMAIL_SOURCES.test(source)) {
      await notifyNewError({ source, message, tenantId, occurrences: count });
    }
    return { created: true };
  } catch (err) {
    // console direto (não logger): o logger grava aqui, e isso viraria um laço.
    console.error('[opsAlert] falha ao gravar alerta', err instanceof Error ? err.message : err);
    return { created: false };
  }
}

/** E-mail de erro novo para quem está na lista do /interno (PLATFORM_ADMIN_EMAILS). */
async function notifyNewError(input: { source: string; message: string; tenantId: string | null; occurrences: number }) {
  const admins = getPlatformAdminEmails();
  if (admins.length === 0) return;
  const limit = await checkRateLimitDurable('opsalert:new-error-email', NEW_ERROR_EMAILS_PER_HOUR, 60 * 60 * 1000);
  if (!limit.ok) return;

  let tenantName: string | null = null;
  if (input.tenantId) {
    const { data } = await supabaseAdmin.from('tenants').select('name').eq('id', input.tenantId).maybeSingle();
    tenantName = data?.name || null;
  }

  const dashboardUrl = `${appBaseUrl()}/interno`;
  const company = tenantName ? `${tenantName} (${input.tenantId})` : input.tenantId;
  const subject = `[Domu Tech] Erro novo: ${input.source}${tenantName ? ` · ${tenantName}` : ''}`.slice(0, 160);
  const text = `Apareceu um erro novo no painel /interno.\n\nOrigem: ${input.source}\n${
    company ? `Empresa: ${company}\n` : ''
  }Mensagem: ${input.message}\n\nSe ele se repetir, só soma no contador do painel (sem novo e-mail).\nVer detalhes: ${dashboardUrl}`;
  const bodyHtml = `<p style="margin:0 0 12px;">Apareceu um erro novo no painel /interno.</p>
<p style="margin:0 0 6px;"><strong>Origem:</strong> ${escapeHtml(input.source)}</p>${
    company ? `<p style="margin:0 0 6px;"><strong>Empresa:</strong> ${escapeHtml(company)}</p>` : ''
  }<p style="margin:0 0 12px;"><strong>Mensagem:</strong> ${escapeHtml(input.message.slice(0, 600))}</p>
<p style="margin:0;color:#64748b;font-size:13px;">Se ele se repetir, só soma no contador do painel, sem novo e-mail. Ao marcar como resolvido, um novo e-mail chega se ele voltar.</p>`;

  try {
    await Promise.all(
      admins.map((to) =>
        sendEmail({
          to,
          subject,
          text,
          html: brandedEmailHtml({ heading: 'Erro novo no sistema', bodyHtml, ctaLabel: 'Abrir o painel interno', ctaUrl: dashboardUrl }),
        })
      )
    );
  } catch (err) {
    console.error('[opsAlert] e-mail de erro novo falhou', err instanceof Error ? err.message : err);
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
  const { created } = await recordOpsEvent(input);
  if (!created && (input.level || 'error') === 'error') {
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
