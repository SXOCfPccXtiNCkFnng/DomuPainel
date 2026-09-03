/**
 * Smoke E2E: cria campanha SCHEDULED vencida, chama o cron, verifica mudança de status, limpa.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.CRON_SECRET || process.env.DOMU_CRON_SECRET;
const base = (process.env.CRON_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

if (!url || !key || !secret) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou CRON_SECRET.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: tenant, error: tenantErr } = await sb.from('tenants').select('id').limit(1).maybeSingle();
if (tenantErr) throw tenantErr;
if (!tenant) {
  console.error('Nenhum tenant no banco para o teste.');
  process.exit(1);
}

const { data: tpl } = await sb
  .from('hsm_templates')
  .select('id')
  .eq('tenant_id', tenant.id)
  .limit(1)
  .maybeSingle();

const past = new Date(Date.now() - 60_000).toISOString();
const { data: camp, error: insertErr } = await sb
  .from('campaigns')
  .insert({
    tenant_id: tenant.id,
    template_id: tpl?.id || null,
    name: '[TESTE CRON] agendada vencida',
    segment: 'all',
    status: 'SCHEDULED',
    scheduled_at: past,
    total_leads: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
  })
  .select('id, status')
  .single();

if (insertErr) {
  console.error(insertErr);
  process.exit(1);
}

console.log('Criada campanha', camp.id, 'status', camp.status);

try {
  const res = await fetch(`${base}/api/campaigns/run-due`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json();
  console.log('Cron HTTP', res.status);
  console.log(JSON.stringify(body, null, 2));

  const { data: after } = await sb.from('campaigns').select('id, status').eq('id', camp.id).single();
  console.log('Status depois:', after?.status);

  if (after?.status === 'SCHEDULED') {
    console.error('FAIL: cron não processou a campanha vencida.');
    process.exitCode = 1;
  } else {
    console.log('OK: cron tirou de SCHEDULED →', after?.status);
  }
} finally {
  await sb.from('campaign_logs').delete().eq('campaign_id', camp.id);
  await sb.from('campaigns').delete().eq('id', camp.id);
  console.log('Campanha de teste removida.');
}
