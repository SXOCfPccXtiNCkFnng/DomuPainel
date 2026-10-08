import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseServer', () => ({ supabaseAdmin: {} }));

import { resolveMetaCredentials, sendMetaTemplate, sendMetaText } from '../metaClient';

describe('envio só com credenciais verificadas', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  afterEach(() => {
    fetchSpy.mockReset();
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_PHONE_NUMBER_ID;
  });

  it('sendMetaTemplate recusa sem credenciais e não chama a Meta', async () => {
    await expect(
      sendMetaTemplate({ to: '5511999999999', templateName: 'x', credentials: undefined as any })
    ).rejects.toThrow('Envio bloqueado');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sendMetaText recusa sem credenciais e não chama a Meta', async () => {
    await expect(
      sendMetaText({ to: '5511999999999', textBody: 'oi', credentials: undefined as any })
    ).rejects.toThrow('Envio bloqueado');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cliente sem credencial própria NUNCA cai no token global do env', async () => {
    process.env.META_ACCESS_TOKEN = 'token-global';
    process.env.META_PHONE_NUMBER_ID = 'numero-global';
    const supabase = await import('../supabaseServer');
    (supabase.supabaseAdmin as any).from = () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    });
    await expect(resolveMetaCredentials('tenant-sem-whatsapp')).rejects.toThrow(
      'WhatsApp não conectado'
    );
  });
});
