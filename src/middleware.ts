import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'domu_session';
const PUBLIC_PATHS = [
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/redefinir-senha',
  '/convite',
];
const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/accept-invite',
  '/api/whatsapp/webhook',
  '/api/campaigns/run-due',
  '/api/billing/webhook',
  '/api/billing/expiry-check',
];

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlEncode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function getEdgeSessionSecret(): string | null {
  const secret = process.env.DOMU_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') return null;
  if (secret && secret.length >= 16) return secret;
  return 'domu_dev_session_secret_change_me_2026';
}

/** Verifica HMAC + exp do cookie de sessão (Edge / Web Crypto). */
async function verifySessionCookie(token: string | undefined): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const secret = getEdgeSessionSecret();
  if (!secret) return false;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
    const expected = b64urlEncode(mac);
    if (!timingSafeEqual(signature, expected)) return false;

    const raw = new TextDecoder().decode(b64urlDecode(encoded));
    const payload = JSON.parse(raw) as { uid?: string; tid?: string; exp?: number };
    if (!payload?.uid || !payload?.tid || !payload?.exp) return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Gate de páginas: exige cookie de sessão com HMAC válido.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const hasValidSession = await verifySessionCookie(token);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasValidSession && !isPublic) {
    const login = new URL('/login', req.url);
    if (pathname !== '/') login.searchParams.set('next', pathname);
    const res = NextResponse.redirect(login);
    if (token) {
      res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    }
    return res;
  }

  if (hasValidSession && isPublic) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
