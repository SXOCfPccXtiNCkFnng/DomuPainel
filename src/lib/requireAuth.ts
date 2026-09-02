import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionSecret } from '@/lib/envSecrets';

export const SESSION_COOKIE = 'domu_session';

export type SessionPayload = {
  uid: string;
  tid: string;
  role: string;
  exp: number;
  rem?: boolean;
};

export type AuthSession = {
  userId: string;
  tenantId: string;
  role: string;
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

export function createSessionToken(
  payload: Omit<SessionPayload, 'exp'> & { exp?: number },
  maxAgeSeconds: number
): string {
  const body: SessionPayload = {
    uid: payload.uid,
    tid: payload.tid,
    role: payload.role,
    rem: payload.rem,
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

export function getSessionFromRequest(req: NextRequest): AuthSession | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return {
    userId: payload.uid,
    tenantId: payload.tid,
    role: payload.role || 'ADMIN',
  };
}

/** Use no topo de rotas protegidas. Nunca confie em tenantId do client. */
export function requireAuth(
  req: NextRequest
): { session: AuthSession } | { error: NextResponse } {
  const session = getSessionFromRequest(req);
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Não autenticado. Faça login novamente.' },
        { status: 401 }
      ),
    };
  }
  return { session };
}

export function requireAdmin(
  req: NextRequest
): { session: AuthSession } | { error: NextResponse } {
  const auth = requireAuth(req);
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

export function requireRole(
  req: NextRequest,
  roles: string[]
): { session: AuthSession } | { error: NextResponse } {
  const auth = requireAuth(req);
  if ('error' in auth) return auth;
  if (!roles.includes(auth.session.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Você não tem permissão para esta ação.' },
        { status: 403 }
      ),
    };
  }
  return auth;
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
  session: { userId: string; tenantId: string; role: string },
  rememberMe: boolean
): void {
  const maxAge = sessionMaxAgeSeconds(rememberMe);
  const token = createSessionToken(
    {
      uid: session.userId,
      tid: session.tenantId,
      role: session.role,
      rem: rememberMe,
    },
    maxAge
  );

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
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
