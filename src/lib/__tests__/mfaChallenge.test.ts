import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import {
  applyMfaChallengeCookie,
  applySessionCookie,
  MFA_COOKIE,
  readMfaChallenge,
  SESSION_COOKIE,
  verifySessionToken,
} from '../requireAuth';

const input = { userId: 'u1', tenantId: 't1', role: 'ADMIN', passwordHash: 'hash', rememberMe: true };

function cookieValue(res: NextResponse, name: string): string {
  return res.cookies.get(name)?.value || '';
}

function requestWith(name: string, value: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/mfa/verify', { headers: { cookie: `${name}=${value}` } });
}

describe('passe da segunda etapa', () => {
  it('guarda quem acertou a senha', () => {
    const res = NextResponse.json({});
    applyMfaChallengeCookie(res, input);
    const challenge = readMfaChallenge(requestWith(MFA_COOKIE, cookieValue(res, MFA_COOKIE)));
    expect(challenge).toMatchObject({ uid: 'u1', tid: 't1', role: 'ADMIN', rem: true });
  });

  it('não vale como sessão (não abre o painel só com a senha)', () => {
    const res = NextResponse.json({});
    applyMfaChallengeCookie(res, input);
    expect(verifySessionToken(cookieValue(res, MFA_COOKIE))).toBeNull();
  });

  it('a sessão não vale como passe', () => {
    const res = NextResponse.json({});
    applySessionCookie(res, input, true);
    expect(readMfaChallenge(requestWith(MFA_COOKIE, cookieValue(res, SESSION_COOKIE)))).toBeNull();
  });

  it('a sessão lembra se entrou com o código (exigido no /interno)', () => {
    const withCode = NextResponse.json({});
    applySessionCookie(withCode, { ...input, mfa: true }, true);
    expect(verifySessionToken(cookieValue(withCode, SESSION_COOKIE))?.mfa).toBe(true);

    const passwordOnly = NextResponse.json({});
    applySessionCookie(passwordOnly, input, true);
    expect(verifySessionToken(cookieValue(passwordOnly, SESSION_COOKIE))?.mfa).toBeUndefined();
  });

  it('passe adulterado é recusado', () => {
    const res = NextResponse.json({});
    applyMfaChallengeCookie(res, input);
    const [encoded, signature] = cookieValue(res, MFA_COOKIE).split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'outro', tid: 't1', role: 'ADMIN', pv: 'x', rem: true, exp: 9e9 }))
      .toString('base64url');
    expect(readMfaChallenge(requestWith(MFA_COOKIE, `${forged}.${signature}`))).toBeNull();
    const tampered = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    expect(readMfaChallenge(requestWith(MFA_COOKIE, `${encoded}.${tampered}`))).toBeNull();
  });
});
