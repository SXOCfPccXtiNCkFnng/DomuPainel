import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Usuário "no banco" que o requireAuth consulta.
let dbUser: { role: string; tenant_id: string; password_hash: string } | null = null;

vi.mock('../supabaseServer', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: dbUser, error: null }),
        }),
      }),
    }),
  },
}));

import {
  SESSION_COOKIE,
  createSessionToken,
  passwordFingerprint,
  requireAuth,
} from '../requireAuth';
import { escapeHtml } from '../emailTemplates';

function requestWith(token: string): NextRequest {
  return new NextRequest('http://localhost/api/leads', {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
}

function tokenFor(passwordHash: string, role = 'ADMIN') {
  return createSessionToken(
    { uid: 'user-1', tid: 'tenant-1', role, pv: passwordFingerprint(passwordHash) },
    3600
  );
}

describe('requireAuth — revogação de sessão', () => {
  beforeEach(() => {
    dbUser = { role: 'ADMIN', tenant_id: 'tenant-1', password_hash: 'hash-original' };
  });

  it('aceita sessão válida', async () => {
    const auth = await requireAuth(requestWith(tokenFor('hash-original')));
    expect('session' in auth && auth.session.userId).toBe('user-1');
  });

  it('derruba sessão de usuário removido', async () => {
    dbUser = null;
    const auth = await requireAuth(requestWith(tokenFor('hash-original')));
    expect('error' in auth && auth.error.status).toBe(401);
  });

  it('derruba sessão depois de troca/reset de senha', async () => {
    const token = tokenFor('hash-original');
    dbUser!.password_hash = 'hash-novo';
    const auth = await requireAuth(requestWith(token));
    expect('error' in auth && auth.error.status).toBe(401);
  });

  it('derruba token antigo sem impressão da senha', async () => {
    const legacy = createSessionToken({ uid: 'user-1', tid: 'tenant-1', role: 'ADMIN' }, 3600);
    const auth = await requireAuth(requestWith(legacy));
    expect('error' in auth && auth.error.status).toBe(401);
  });

  it('usa a role do banco, não a do cookie', async () => {
    dbUser!.role = 'attendant';
    const auth = await requireAuth(requestWith(tokenFor('hash-original', 'ADMIN')));
    expect('session' in auth && auth.session.role).toBe('ATTENDANT');
  });
});

describe('escapeHtml', () => {
  it('neutraliza HTML em nomes vindos do usuário', () => {
    expect(escapeHtml('<a href="https://x.co">Clique</a>')).toBe(
      '&lt;a href=&quot;https://x.co&quot;&gt;Clique&lt;/a&gt;'
    );
    expect(escapeHtml("O'Brien & Cia")).toBe('O&#39;Brien &amp; Cia');
    expect(escapeHtml(null)).toBe('');
  });
});
