import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionSecret } from '@/lib/envSecrets';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const SESSION_COOKIE = 'domu_session';

export type SessionPayload = {
  uid: string;
  tid: string;
  role: string;
  exp: number;
  rem?: boolean;
  /** Impressão do password_hash: troca/reset de senha derruba sessões antigas. */
  pv?: string;
};

export type AuthSession = {
  userId: string;
  tenantId: string;
  role: string;
  rememberMe?: boolean;
};

function b64urlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(data: string): string {
  return b64urlEncode(crypto.createHmac('sha256', getSessionSecret()).update(data).digest());
}

/** HMAC curto do hash da senha — não revela nada do hash, só muda quando a senha muda. */
export function passwordFingerprint(passwordHash: string): string {
  return sign(`pv:${passwordHash}`).slice(0, 16);
}

export function createSessionToken(
  payload: Omit<SessionPayload, 'exp'> & { exp?: number },
  maxAgeSeconds: number
): string {
  const body: SessionPayload = {
    uid: payload.uid,
    tid: payload.tid,
    role: payload.role,
    rem: payload.rem,
    pv: payload.pv,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encoded = b64urlEncode(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const raw = b64urlDecode(encoded).toString('utf8');
    const payload = JSON.parse(raw) as SessionPayload;
    if (!payload?.uid || !payload?.tid || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Só valida a assinatura/expiração do cookie — NÃO sabe se o usuário foi
 * removido ou trocou a senha. Para autorizar, use requireAuth.
 */
export function getSessionFromRequest(req: NextRequest): AuthSession | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return {
    userId: payload.uid,
    tenantId: payload.tid,
    role: payload.role || 'ADMIN',
    rememberMe: payload.rem,
  };
}

function unauthorized(message = 'Sessão inválida. Faça login novamente.') {
  return {
    error: NextResponse.json({ success: false, error: message }, { status: 401 }),
  };
}

/**
 * Use no topo de rotas protegidas. Nunca confie em tenantId do client.
 * Revalida no banco a cada chamada: usuário removido, senha trocada/resetada
 * ou tenant diferente derrubam a sessão; a role vem do banco, não do cookie.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ session: AuthSession } | { error: NextResponse }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return unauthorized('Não autenticado. Faça login novamente.');

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role, tenant_id, password_hash')
    .eq('id', payload.uid)
    .maybeSingle();

  if (error) throw error;
  if (!user || user.tenant_id !== payload.tid) return unauthorized();

  const expectedPv = passwordFingerprint(String(user.password_hash || ''));
  const gotPv = Buffer.from(String(payload.pv || ''));
  const wantPv = Buffer.from(expectedPv);
  if (gotPv.length !== wantPv.length || !crypto.timingSafeEqual(gotPv, wantPv)) {
    return unauthorized();
  }

  return {
    session: {
      userId: payload.uid,
      tenantId: payload.tid,
      role: String(user.role || 'ATTENDANT').toUpperCase(),
      rememberMe: payload.rem,
    },
  };
}

/** Admin com role revalidada no banco (não só no cookie). */
export async function requireAdmin(
  req: NextRequest
): Promise<{ session: AuthSession } | { error: NextResponse }> {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;

  if (auth.session.role !== 'ADMIN' && auth.session.role !== 'SUPER_ADMIN') {
    return {
      error: NextResponse.json(
        { success: false, error: 'Acesso restrito a administradores.' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/** Role revalidada no banco. */
export async function requireRole(
  req: NextRequest,
  roles: string[]
): Promise<{ session: AuthSession } | { error: NextResponse }> {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth;

  const allowed = roles.map((r) => r.toUpperCase());
  if (!allowed.includes(auth.session.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Você não tem permissão para esta ação.' },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/** Admin ou corretor — operações de campanha/template. */
export async function requireDispatcher(
  req: NextRequest
): Promise<{ session: AuthSession } | { error: NextResponse }> {
  return requireRole(req, ['ADMIN', 'SUPER_ADMIN', 'BROKER']);
}

export const TEAM_ROLES = ['ADMIN', 'BROKER', 'ATTENDANT'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export function isValidTeamRole(role: string): role is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(role);
}

export function sessionMaxAgeSeconds(rememberMe: boolean): number {
  return rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 12; // 30d ou 12h
}

export function applySessionCookie(
  res: NextResponse,
  session: { userId: string; tenantId: string; role: string; passwordHash: string },
  rememberMe: boolean
): void {
  const maxAge = sessionMaxAgeSeconds(rememberMe);
  const token = createSessionToken(
    {
      uid: session.userId,
      tid: session.tenantId,
      role: session.role,
      rem: rememberMe,
      pv: passwordFingerprint(session.passwordHash),
    },
    maxAge
  );

  // Sem "lembrar de mim": cookie de sessão real do navegador (sem maxAge),
  // apagado ao fechar o navegador. O token ainda expira em 12h por dentro
  // (exp no payload) como segunda camada de segurança. Com "lembrar de mim":
  // cookie persistente de 30 dias.
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(rememberMe ? { maxAge } : {}),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
