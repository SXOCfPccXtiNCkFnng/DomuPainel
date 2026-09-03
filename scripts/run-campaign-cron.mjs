/**
 * Dispara / testa o cron de campanhas agendadas localmente.
 *
 * Uso:
 *   node scripts/run-campaign-cron.mjs
 *   node scripts/run-campaign-cron.mjs --base http://localhost:3000
 *
 * Lê CRON_SECRET de .env.local (ou do ambiente).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

const args = process.argv.slice(2);
let base = process.env.CRON_BASE_URL || 'http://localhost:3000';
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--base' && args[i + 1]) {
    base = args[i + 1].replace(/\/$/, '');
    i += 1;
  }
}

const secret = process.env.CRON_SECRET || process.env.DOMU_CRON_SECRET;
if (!secret || secret.length < 16) {
  console.error('CRON_SECRET ausente ou curto demais (mín. 16). Defina em .env.local.');
  process.exit(1);
}

const url = `${base}/api/campaigns/run-due`;

async function request(label, init) {
  const res = await fetch(url, init);
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  console.log(`\n[${label}] HTTP ${res.status}`);
  console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  return { res, body };
}

async function main() {
  console.log(`Cron target: ${url}`);

  const unauthorized = await request('sem auth (espera 401)', { method: 'GET' });
  if (unauthorized.res.status !== 401) {
    console.error('Falha: GET sem secret deveria retornar 401.');
    process.exit(1);
  }

  const authorized = await request('com Bearer CRON_SECRET', {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!authorized.res.ok) {
    console.error('Falha: GET autenticado deveria retornar 2xx.');
    process.exit(1);
  }

  const body = authorized.body;
  if (!body || body.success !== true || body.source !== 'cron') {
    console.error('Falha: resposta inesperada do cron.');
    process.exit(1);
  }

  console.log(
    `\nOK — mode=${body.mode} campaigns=${body.campaigns} processed=${body.processed} skipped=${body.skipped}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
