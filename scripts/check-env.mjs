/**
 * Valida presença/tamanho de secrets sem imprimir valores.
 * Uso: node scripts/check-env.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('FAIL: .env.local não encontrado');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const map = {};
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  map[key] = val;
}

function valueLen(key) {
  const val = map[key];
  return val ? val.length : 0;
}

function hasAny(keys, min) {
  for (const key of keys) {
    if (map[key] && map[key].length >= min) return { ok: true, key, len: map[key].length };
  }
  const present = keys.find((k) => map[k]);
  if (present) return { ok: false, key: present, len: map[present].length, tooShort: true };
  return { ok: false, key: keys[0], len: 0, missing: true };
}

let failed = 0;

const session = hasAny(['DOMU_SESSION_SECRET', 'NEXTAUTH_SECRET'], 32);
if (session.ok) {
  console.log(`${session.key}: OK (len=${session.len})`);
} else if (session.tooShort) {
  console.log(`${session.key}: TOO_SHORT (len=${session.len}, min=32)`);
  failed += 1;
} else {
  console.log('DOMU_SESSION_SECRET|NEXTAUTH_SECRET: MISSING (obrigatório, mín. 32)');
  failed += 1;
}

const checks = [
  { key: 'ENCRYPTION_SECRET_KEY', min: 32, required: true },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', min: 8, required: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', min: 20, required: true },
  { key: 'META_APP_SECRET', min: 8, required: false, prodImportant: true },
  { key: 'META_VERIFY_TOKEN', min: 8, required: false },
  { key: 'RESEND_API_KEY', min: 8, required: false },
  { key: 'CRON_SECRET', min: 16, required: false },
  { key: 'NEXT_PUBLIC_APP_URL', min: 8, required: false },
];

for (const c of checks) {
  const val = map[c.key];
  if (!val) {
    const tag = c.required
      ? 'MISSING (obrigatório)'
      : c.prodImportant
        ? 'MISSING (importante em prod/webhook)'
        : 'optional missing';
    console.log(`${c.key}: ${tag}`);
    if (c.required) failed += 1;
    continue;
  }
  if (val.length < c.min) {
    console.log(`${c.key}: TOO_SHORT (len=${val.length}, min=${c.min})`);
    failed += 1;
  } else {
    console.log(`${c.key}: OK (len=${val.length})`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} problema(s) encontrado(s).`);
  process.exit(1);
}
console.log('\nSecrets check OK.');
