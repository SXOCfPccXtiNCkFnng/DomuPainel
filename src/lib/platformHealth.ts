/**
 * Diagnóstico do painel /interno: confere de uma vez o que já derrubou a
 * produção antes — migration não aplicada, chave faltando, webhook apontando
 * para outro lugar, cron parado, fila travada. Cada item diz o que fazer.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { META_GRAPH_API_VERSION } from '@/lib/metaClient';
import { HEARTBEATS, loadHeartbeats } from '@/lib/heartbeat';

export type HealthStatus = 'ok' | 'warn' | 'fail';

export type HealthCheck = {
  id: string;
  group: 'Banco de dados' | 'Configuração' | 'Integrações' | 'Rotinas' | 'Filas';
  label: string;
  status: HealthStatus;
  detail: string;
  fix?: string;
};

const FAKE_TENANT = '00000000-0000-0000-0000-000000000000';
const MIN = 60 * 1000;

/** Colunas que o código usa, com a migration que as cria. */
const REQUIRED_COLUMNS: { table: string; columns: string; migration: string }[] = [
  { table: 'leads', columns: 'source', migration: '20261009_chat_messages_dedupe_lead_source.sql' },
  { table: 'leads', columns: 'follow_up_paused', migration: '20261009_follow_ups.sql' },
  { table: 'follow_up_settings', columns: 'conversation_enabled, ai_check_enabled', migration: '20261009_follow_ups.sql' },
  { table: 'follow_up_settings', columns: 'contact_limit_enabled', migration: '20261009_follow_up_contact_limit.sql' },
  { table: 'follow_ups', columns: 'deadline_at, skip_code', migration: '20261009_follow_ups.sql' },
  { table: 'campaign_logs', columns: 'recipient_name, recipient_phone', migration: '20261013_campaign_logs_keep_history.sql' },
  { table: 'ops_alerts', columns: 'fingerprint, occurrences', migration: '20261013_ops_observability.sql' },
  { table: 'system_heartbeats', columns: 'name', migration: '20261013_ops_observability.sql' },
  { table: 'plan_prices', columns: 'plan_tier', migration: '20260908_plan_prices.sql' },
  { table: 'subscription_price_changes', columns: 'id', migration: '20260908_subscription_price_changes.sql' },
];

/**
 * Chaves únicas que os upserts exigem. Teste sem efeito: insere com um tenant
 * inexistente — se a chave existe o banco recusa pela FK (23503, nada gravado);
 * se não existe, recusa antes com 42P10 ("no unique constraint").
 */
const REQUIRED_UNIQUE: { id: string; label: string; table: string; onConflict: string; row: Record<string, unknown>; migration: string }[] = [
  {
    id: 'uq_leads',
    label: 'Contato único por telefone (captura automática e importação)',
    table: 'leads',
    onConflict: 'tenant_id,phone',
    row: { tenant_id: FAKE_TENANT, name: 'diagnostico', phone: '0' },
    migration: '20261009_ensure_upsert_unique_keys.sql',
  },
  {
    id: 'uq_chat_messages',
    label: 'Mensagem do atendimento sem duplicar',
    table: 'chat_messages',
    onConflict: 'tenant_id,wamid',
    row: { tenant_id: FAKE_TENANT, lead_id: FAKE_TENANT, direction: 'INBOUND', wamid: 'diagnostico' },
    migration: '20261009_ensure_upsert_unique_keys.sql',
  },
  {
    id: 'uq_credentials',
    label: 'Uma conexão de WhatsApp por conta',
    table: 'tenant_credentials',
    onConflict: 'tenant_id',
    row: {
      tenant_id: FAKE_TENANT,
      waba_id: 'x',
      phone_number_id: 'diagnostico',
      encrypted_access_token: 'x',
      token_encryption_iv: 'x',
      verify_token: 'x',
    },
    migration: 'schema.sql (UNIQUE em tenant_credentials.tenant_id)',
  },
];

const REQUIRED_ENV: { keys: string[]; label: string; why: string; minLength?: number }[] = [
  { keys: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], label: 'Supabase', why: 'acesso ao banco' },
  { keys: ['ENCRYPTION_SECRET_KEY'], label: 'ENCRYPTION_SECRET_KEY', why: 'criptografia dos tokens da Meta' },
  { keys: ['DOMU_SESSION_SECRET|NEXTAUTH_SECRET'], label: 'Segredo de sessão', why: 'login dos usuários' },
  { keys: ['NEXT_PUBLIC_APP_URL|APP_URL'], label: 'URL do app', why: 'links de e-mail e webhook' },
  { keys: ['NEXT_PUBLIC_META_APP_ID', 'META_APP_SECRET', 'NEXT_PUBLIC_META_CONFIG_ID'], label: 'App da Meta', why: 'conexão do WhatsApp e assinatura dos webhooks' },
  { keys: ['CRON_SECRET|DOMU_CRON_SECRET'], label: 'CRON_SECRET', why: 'autenticação dos crons', minLength: 16 },
  { keys: ['RESEND_API_KEY', 'EMAIL_FROM'], label: 'E-mail (Resend)', why: 'recuperação de senha, convites e avisos' },
  { keys: ['ASAAS_API_KEY', 'ASAAS_WEBHOOK_TOKEN'], label: 'Asaas', why: 'cobrança das assinaturas' },
  { keys: ['GEMINI_API_KEY'], label: 'GEMINI_API_KEY', why: 'checagem de contexto do follow-up e chat de suporte' },
  { keys: ['PLATFORM_ADMIN_EMAILS'], label: 'PLATFORM_ADMIN_EMAILS', why: 'acesso a este painel e e-mails de alerta' },
];

function envValue(spec: string): string {
  for (const key of spec.split('|')) {
    const v = process.env[key];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

function ago(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / MIN);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h}h`;
  return `há ${Math.round(h / 24)} dias`;
}

async function databaseChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  const columnResults = await Promise.all(
    REQUIRED_COLUMNS.map(async (c) => ({ c, res: await supabaseAdmin.from(c.table).select(c.columns).limit(1) }))
  );
  const missing = columnResults.filter(({ res }) => res.error && ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(res.error.code)));
  const migrations = [...new Set(missing.map(({ c }) => c.migration))];
  checks.push({
    id: 'db_columns',
    group: 'Banco de dados',
    label: 'Tabelas e colunas que o código usa',
    status: missing.length === 0 ? 'ok' : 'fail',
    detail:
      missing.length === 0
        ? `${REQUIRED_COLUMNS.length} verificações em dia.`
        : `Faltando: ${missing.map(({ c }) => `${c.table}.${c.columns}`).join('; ')}.`,
    fix: missing.length ? `Rode no SQL Editor do Supabase: ${migrations.join(', ')}.` : undefined,
  });

  for (const u of REQUIRED_UNIQUE) {
    const { error } = await supabaseAdmin.from(u.table).upsert(u.row, { onConflict: u.onConflict, ignoreDuplicates: true });
    // Não deveria gravar (tenant inexistente); se gravou, apaga na hora.
    if (!error) await supabaseAdmin.from(u.table).delete().eq('tenant_id', FAKE_TENANT);
    const code = String(error?.code || '');
    const missingKey = code === '42P10';
    const ok = code === '23503' || code === '23502' || code === '23514';
    checks.push({
      id: u.id,
      group: 'Banco de dados',
      label: u.label,
      status: missingKey ? 'fail' : ok ? 'ok' : 'warn',
      detail: missingKey
        ? `A chave única (${u.onConflict}) não existe — essa operação falha em produção.`
        : ok
          ? `Chave única (${u.onConflict}) presente.`
          : `Não deu para confirmar (${error ? `${code} ${error.message}` : 'sem erro'}).`,
      fix: missingKey ? `Rode no SQL Editor do Supabase: ${u.migration}.` : undefined,
    });
  }
  return checks;
}

function configChecks(): HealthCheck[] {
  const checks: HealthCheck[] = REQUIRED_ENV.map((spec) => {
    const missingKeys = spec.keys.filter((k) => !envValue(k));
    const short = spec.minLength ? spec.keys.filter((k) => envValue(k) && envValue(k).length < spec.minLength!) : [];
    const status: HealthStatus = missingKeys.length ? 'fail' : short.length ? 'warn' : 'ok';
    return {
      id: `env_${spec.label}`,
      group: 'Configuração',
      label: spec.label,
      status,
      detail: missingKeys.length
        ? `Não configurado: ${missingKeys.map((k) => k.replace('|', ' ou ')).join(', ')} — afeta ${spec.why}.`
        : short.length
          ? `Muito curto (mínimo ${spec.minLength} caracteres).`
          : `Configurado (${spec.why}).`,
      fix: missingKeys.length || short.length ? 'Adicione nas variáveis de ambiente da hospedagem e faça um novo deploy.' : undefined,
    };
  });

  const appUrl = envValue('NEXT_PUBLIC_APP_URL|APP_URL');
  if (appUrl && !appUrl.startsWith('https://')) {
    checks.push({
      id: 'env_app_url_https',
      group: 'Configuração',
      label: 'URL do app em HTTPS',
      status: 'warn',
      detail: `NEXT_PUBLIC_APP_URL é "${appUrl}" — links de e-mail e o webhook da Meta precisam de https em produção.`,
      fix: 'Ajuste para https://painel.domutech.digital nas variáveis de produção.',
    });
  }
  if (process.env.BILLING_MOCK === '1' || process.env.BILLING_MOCK === 'true') {
    checks.push({
      id: 'env_billing_mock',
      group: 'Configuração',
      label: 'Cobrança simulada',
      status: process.env.NODE_ENV === 'production' ? 'fail' : 'warn',
      detail: 'BILLING_MOCK está ligado: pagamentos não passam pela Asaas.',
      fix: 'Remova BILLING_MOCK das variáveis de produção.',
    });
  }
  return checks;
}

async function integrationChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // IA do follow-up: chave válida e modelo disponível (consulta grátis, não gasta cota).
  const geminiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_FOLLOWUP_MODEL || 'gemini-3.8-flash';
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
        headers: { 'x-goog-api-key': geminiKey },
        signal: AbortSignal.timeout(8000),
      });
      checks.push({
        id: 'gemini',
        group: 'Integrações',
        label: `IA (Gemini · ${model})`,
        status: res.ok ? 'ok' : 'fail',
        detail: res.ok
          ? 'Chave válida e modelo disponível. (Cota esgotada aparece em Erros como "cota da IA".)'
          : res.status === 404
            ? 'Modelo não encontrado para essa chave.'
            : `A Google recusou a chave (HTTP ${res.status}).`,
        fix: res.ok ? undefined : 'Confira GEMINI_API_KEY e GEMINI_FOLLOWUP_MODEL; gere outra chave no Google AI Studio se preciso.',
      });
    } catch (err) {
      checks.push({
        id: 'gemini',
        group: 'Integrações',
        label: `IA (Gemini · ${model})`,
        status: 'warn',
        detail: `Sem resposta da Google: ${err instanceof Error ? err.message : 'erro'}.`,
      });
    }
  }

  // Webhook da Meta: o app recebe eventos na URL da Domu, com os campos certos.
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = envValue('NEXT_PUBLIC_APP_URL|APP_URL') || 'https://painel.domutech.digital';
  if (appId && appSecret) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${appId}/subscriptions?access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const json = await res.json();
      const sub = (json.data || []).find((s: any) => s.object === 'whatsapp_business_account');
      const fields: string[] = (sub?.fields || []).map((f: any) => f.name);
      const expectedUrl = `${appUrl.replace(/\/$/, '')}/api/whatsapp/webhook`;
      const problems: string[] = [];
      if (!res.ok) problems.push(`a Meta recusou a consulta (${json?.error?.message || res.status})`);
      else if (!sub) problems.push('nenhum webhook de WhatsApp configurado no app');
      else {
        if (sub.callback_url !== expectedUrl) problems.push(`URL é ${sub.callback_url} (esperado ${expectedUrl})`);
        if (!sub.active) problems.push('webhook inativo');
        for (const f of ['messages', 'smb_message_echoes']) if (!fields.includes(f)) problems.push(`campo "${f}" não assinado`);
      }
      checks.push({
        id: 'meta_webhook',
        group: 'Integrações',
        label: 'Webhook da Meta (app)',
        status: problems.length === 0 ? 'ok' : 'fail',
        detail: problems.length === 0 ? `Recebendo em ${expectedUrl} (${fields.join(', ')}).` : problems.join('; ') + '.',
        fix: problems.length
          ? 'developers.facebook.com → app → WhatsApp → Configuração → Webhook: URL da Domu e campos messages + smb_message_echoes.'
          : undefined,
      });
    } catch (err) {
      checks.push({
        id: 'meta_webhook',
        group: 'Integrações',
        label: 'Webhook da Meta (app)',
        status: 'warn',
        detail: `Sem resposta da Meta: ${err instanceof Error ? err.message : 'erro'}.`,
      });
    }
  }
  return checks;
}

async function routineChecks(): Promise<HealthCheck[]> {
  const beats = await loadHeartbeats();
  if (!beats) {
    return [
      {
        id: 'heartbeats_table',
        group: 'Rotinas',
        label: 'Registro de execuções',
        status: 'fail',
        detail: 'A tabela system_heartbeats não existe — não dá para saber se os crons estão rodando.',
        fix: 'Rode no SQL Editor do Supabase: 20261013_ops_observability.sql.',
      },
    ];
  }
  const byName = new Map(beats.map((b) => [b.name, b]));
  return HEARTBEATS.map((h) => {
    const b = byName.get(h.name);
    const base = { id: `hb_${h.name}`, group: 'Rotinas' as const, label: h.label };
    if (!b) {
      return {
        ...base,
        status: h.expectedEveryMin > 0 ? ('warn' as const) : ('ok' as const),
        detail: h.expectedEveryMin > 0 ? 'Ainda não rodou desde que o registro foi ativado.' : 'Nenhum evento recebido ainda.',
        fix: h.expectedEveryMin > 0 ? h.fix : undefined,
      };
    }
    const lateMin = h.expectedEveryMin > 0 ? (Date.now() - new Date(b.lastRunAt || 0).getTime()) / MIN : 0;
    const stale = h.expectedEveryMin > 0 && lateMin > h.expectedEveryMin * 3;
    const failing = Boolean(b.lastError) && (!b.lastOkAt || new Date(b.lastOkAt) < new Date(b.lastRunAt || 0));
    const status: HealthStatus = stale || failing ? 'fail' : 'ok';
    return {
      ...base,
      status,
      detail: stale
        ? `Parado: última execução ${ago(b.lastRunAt)} (esperado a cada ${h.expectedEveryMin >= 60 ? `${h.expectedEveryMin / 60}h` : `${h.expectedEveryMin} min`}).`
        : failing
          ? `Última execução ${ago(b.lastRunAt)} falhou: ${b.lastError}`
          : `Última execução ${ago(b.lastRunAt)} · ${b.runCount.toLocaleString('pt-BR')} no total.`,
      fix: status === 'fail' ? h.fix : undefined,
    };
  });
}

async function queueChecks(): Promise<HealthCheck[]> {
  const now = Date.now();
  const [runningStale, scheduledLate, followStuck, aiFailures] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'RUNNING')
      .lt('updated_at', new Date(now - 30 * MIN).toISOString()),
    supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'SCHEDULED')
      .lt('scheduled_at', new Date(now - 15 * MIN).toISOString()),
    supabaseAdmin
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .lt('due_at', new Date(now - 2 * 60 * MIN).toISOString()),
    supabaseAdmin
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .ilike('error_message', 'Checagem de contexto indisponível%'),
  ]);

  const item = (id: string, label: string, count: number | null, bad: HealthStatus, okText: string, badText: string, fix: string): HealthCheck => ({
    id,
    group: 'Filas',
    label,
    status: (count || 0) > 0 ? bad : 'ok',
    detail: (count || 0) > 0 ? badText.replace('{n}', String(count)) : okText,
    fix: (count || 0) > 0 ? fix : undefined,
  });

  return [
    item('q_running', 'Campanhas enviando', runningStale.count, 'fail', 'Nenhuma campanha travada.', '{n} campanha(s) em "Enviando" sem progresso há mais de 30 min.', 'Confira o cron de campanhas e os erros de "campanha" na aba Erros.'),
    item('q_scheduled', 'Campanhas agendadas', scheduledLate.count, 'fail', 'Nenhuma agendada atrasada.', '{n} campanha(s) passaram mais de 15 min do horário sem sair.', 'O cron de campanhas provavelmente parou — veja Rotinas.'),
    item('q_followup', 'Fila do follow-up', followStuck.count, 'warn', 'Nenhum follow-up atrasado.', '{n} follow-up(s) vencidos há mais de 2h ainda na fila.', 'Confira o cron de follow-up e os erros de "followup" na aba Erros.'),
    item('q_followup_ai', 'IA do follow-up', aiFailures.count, 'warn', 'Nenhum follow-up esperando a IA.', '{n} follow-up(s) aguardando porque a checagem de IA falhou.', 'Veja o motivo na aba Erros (cota da IA, chave inválida...).'),
  ];
}

export async function loadPlatformHealth(): Promise<{
  checkedAt: string;
  summary: Record<HealthStatus, number>;
  checks: HealthCheck[];
}> {
  const groups = await Promise.all([databaseChecks(), Promise.resolve(configChecks()), integrationChecks(), routineChecks(), queueChecks()]);
  const checks = groups.flat();
  const summary: Record<HealthStatus, number> = { ok: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status] += 1;
  return { checkedAt: new Date().toISOString(), summary, checks };
}
