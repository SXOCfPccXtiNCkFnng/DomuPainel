import fs from 'fs';
import crypto from 'crypto';

const path = '.env.local';
const raw = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const map = new Map();
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  map.set(t.slice(0, i).trim(), t.slice(i + 1));
}

function gen(n = 48) {
  return crypto.randomBytes(n).toString('base64url').slice(0, n);
}
function keep(key, fallback = '') {
  const v = map.get(key);
  return v != null && String(v).trim() !== '' ? String(v) : fallback;
}

const session = keep('DOMU_SESSION_SECRET', gen(48));
const encryption = keep('ENCRYPTION_SECRET_KEY', gen(48));
const cron = keep('CRON_SECRET', gen(48));
const admin = keep('DOMU_ADMIN_SECRET', gen(48));

const lines = [
  '# =============================================================================',
  '# Domu Tech — Environment (local). NÃO commitiar este arquivo.',
  '# No Vercel: Settings → Environment Variables (Production) — copie os mesmos.',
  '# =============================================================================',
  '',
  '# --- Meta Cloud API (painel developers.facebook.com) ---',
  `META_ACCESS_TOKEN=${keep('META_ACCESS_TOKEN')}`,
  `META_PHONE_NUMBER_ID=${keep('META_PHONE_NUMBER_ID')}`,
  `META_WABA_ID=${keep('META_WABA_ID')}`,
  `META_VERIFY_TOKEN=${keep('META_VERIFY_TOKEN')}`,
  '# App Secret da Meta (Configurações do app → Segredo do app). Obrigatório p/ webhook em prod.',
  `META_APP_SECRET=${keep('META_APP_SECRET')}`,
  '',
  '# --- Supabase ---',
  `NEXT_PUBLIC_SUPABASE_URL=${keep('NEXT_PUBLIC_SUPABASE_URL')}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${keep('NEXT_PUBLIC_SUPABASE_ANON_KEY')}`,
  `SUPABASE_SERVICE_ROLE_KEY=${keep('SUPABASE_SERVICE_ROLE_KEY')}`,
  '',
  '# --- App URL (local agora; no Vercel use https://seu-projeto.vercel.app) ---',
  `NEXT_PUBLIC_APP_URL=${keep('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')}`,
  '',
  '# --- Segurança (geradas localmente; use as MESMAS no Vercel) ---',
  `DOMU_SESSION_SECRET=${session}`,
  `ENCRYPTION_SECRET_KEY=${encryption}`,
  `CRON_SECRET=${cron}`,
  '# Só se for usar /api/db/seed ou /api/db/test',
  `DOMU_ADMIN_SECRET=${admin}`,
  '',
  '# E-mails com acesso a /interno (separados por vírgula). Sem isto, a página responde 404.',
  `PLATFORM_ADMIN_EMAILS=${keep('PLATFORM_ADMIN_EMAILS')}`,
  '',
  '# --- E-mail (Resend — https://resend.com → API Keys) ---',
  '# Sem isto: reset/convite só aparecem no log do servidor (dev).',
  `RESEND_API_KEY=${keep('RESEND_API_KEY')}`,
  `EMAIL_FROM=${keep('EMAIL_FROM', 'Domu Tech <onboarding@resend.dev>')}`,
  '',
  '# --- Asaas (assinaturas / PIX / cartão) ---',
  '# Sandbox: https://sandbox.asaas.com → Integrações → Chave de API',
  `ASAAS_ENV=${keep('ASAAS_ENV', 'sandbox')}`,
  `ASAAS_API_KEY=${keep('ASAAS_API_KEY')}`,
  `ASAAS_WEBHOOK_TOKEN=${keep('ASAAS_WEBHOOK_TOKEN')}`,
  '# true = ativa plano sem Asaas (só local). Em produção use false + ASAAS_API_KEY.',
  `BILLING_MOCK=${keep('BILLING_MOCK', 'true')}`,
  '',
];

fs.writeFileSync(path, lines.join('\n'), 'utf8');

const empty = [];
for (const line of lines) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const [k, ...rest] = line.split('=');
  if (rest.join('=') === '') empty.push(k);
}
console.log('Rewrote .env.local with all reminder keys.');
console.log('Empty (fill later):', empty.length ? empty.join(', ') : 'none');
console.log('Email needs RESEND_API_KEY from resend.com — cannot invent.');
