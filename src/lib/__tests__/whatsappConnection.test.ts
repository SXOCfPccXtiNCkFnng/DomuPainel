import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Banco simulado -------------------------------------------------------
type Db = {
  cred: Record<string, unknown> | null;
  /** Outras contas com o mesmo phone_number_id. */
  sharing: { tenant_id: string }[];
  tenant: { whatsapp_number: string | null } | null;
};
let db: Db;

function builder(table: string) {
  let excludesSelf = false;
  const api: any = {
    select: () => api,
    eq: () => api,
    neq: () => {
      excludesSelf = true;
      return api;
    },
    limit: () => api,
    maybeSingle: async () => {
      if (table === 'tenant_credentials') return { data: db.cred, error: null };
      if (table === 'tenants') return { data: db.tenant, error: null };
      return { data: null, error: null };
    },
    // `await query` (consulta de compartilhamento do número)
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: table === 'tenant_credentials' && excludesSelf ? db.sharing : [], error: null }),
  };
  return api;
}

vi.mock('../supabaseServer', () => ({ supabaseAdmin: { from: (t: string) => builder(t) } }));
vi.mock('../crypto', () => ({ decryptData: () => 'token-do-cliente' }));

const quality = vi.fn();
vi.mock('../metaClient', () => ({ getPhoneNumberQuality: (...a: unknown[]) => quality(...a) }));

const opsAlert = vi.fn();
vi.mock('../opsAlert', () => ({ logOpsAlert: (...a: unknown[]) => opsAlert(...a) }));

import { requireVerifiedWhatsApp } from '../whatsappConnection';

const connectedCred = {
  phone_number_id: 'pn_123',
  waba_id: 'waba_1',
  encrypted_access_token: 'enc',
  token_encryption_iv: 'iv',
  is_verified: true,
};

describe('requireVerifiedWhatsApp — nenhuma mensagem sai pelo número errado', () => {
  beforeEach(() => {
    db = { cred: connectedCred, sharing: [], tenant: { whatsapp_number: '5511987654321' } };
    quality.mockReset();
    opsAlert.mockReset();
    quality.mockResolvedValue({
      qualityRating: 'GREEN',
      messagingLimitTier: 'TIER_1K',
      nameStatus: 'APPROVED',
      displayPhoneNumber: '+55 11 98765-4321',
    });
  });

  it('libera quando o número da Meta é o mesmo do cadastro (e usa só as credenciais do cliente)', async () => {
    const r = await requireVerifiedWhatsApp('tenant-a');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.credentials).toMatchObject({
        source: 'tenant',
        phoneNumberId: 'pn_123',
        accessToken: 'token-do-cliente',
      });
    }
  });

  it('bloqueia conta sem WhatsApp conectado (nunca usa credencial global)', async () => {
    db.cred = null;
    const r = await requireVerifiedWhatsApp('tenant-a');
    expect(r).toMatchObject({ ok: false, transient: false });
    expect(quality).not.toHaveBeenCalled();
  });

  it('bloqueia credencial não verificada', async () => {
    db.cred = { ...connectedCred, is_verified: false };
    expect((await requireVerifiedWhatsApp('tenant-a')).ok).toBe(false);
  });

  it('bloqueia quando o número da Meta é DIFERENTE do cadastrado', async () => {
    db.tenant = { whatsapp_number: '11911112222' };
    const r = await requireVerifiedWhatsApp('tenant-a');
    expect(r).toMatchObject({ ok: false, transient: false });
    if (!r.ok) expect(r.error).toContain('diferente');
  });

  it('bloqueia quando a conta não tem número cadastrado', async () => {
    db.tenant = { whatsapp_number: '' };
    expect((await requireVerifiedWhatsApp('tenant-a')).ok).toBe(false);
  });

  it('bloqueia e alerta quando o número está ligado a outra conta', async () => {
    db.sharing = [{ tenant_id: 'tenant-b' }];
    const r = await requireVerifiedWhatsApp('tenant-a');
    expect(r).toMatchObject({ ok: false, transient: false });
    expect(opsAlert).toHaveBeenCalled();
    expect(quality).not.toHaveBeenCalled();
  });

  it('token inválido na Meta = bloqueio definitivo (pede reconexão)', async () => {
    quality.mockRejectedValue(new Error('Error validating access token: Session has expired'));
    expect(await requireVerifiedWhatsApp('tenant-a')).toMatchObject({ ok: false, transient: false });
  });

  it('Meta fora do ar = tenta de novo depois, sem falhar a campanha', async () => {
    quality.mockRejectedValue(new Error('fetch failed'));
    expect(await requireVerifiedWhatsApp('tenant-a')).toMatchObject({ ok: false, transient: true });
  });
});
