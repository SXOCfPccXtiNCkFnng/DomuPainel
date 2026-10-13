import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseServer', () => ({ supabaseAdmin: {} }));

import { fingerprintOf, sanitizeMeta } from '../opsAlert';

describe('fingerprintOf (agrupamento de erros)', () => {
  it('mesmo erro com ids/números diferentes vira a mesma linha', () => {
    const a = fingerprintOf('followup.ai_check_http_error', 'Falha para tenant 4725530b-234f-4e87-9880-2523ed017b8f (status 429)');
    const b = fingerprintOf('followup.ai_check_http_error', 'Falha para tenant 11111111-2222-3333-4444-555555555555 (status 503)');
    expect(a).toBe(b);
  });

  it('origem diferente não agrupa', () => {
    expect(fingerprintOf('meta.text_failed', 'x')).not.toBe(fingerprintOf('meta.template_failed', 'x'));
  });
});

describe('sanitizeMeta (detalhes sem segredos)', () => {
  it('esconde tokens, senhas e chaves', () => {
    const out = sanitizeMeta({ accessToken: 'EAA...', password: '123', api_key: 'k', tenantId: 't', status: 429 });
    expect(out).toEqual({ accessToken: '[oculto]', password: '[oculto]', api_key: '[oculto]', tenantId: 't', status: 429 });
  });

  it('corta textos longos', () => {
    const out = sanitizeMeta({ message: 'a'.repeat(5000) });
    expect(String(out.message).length).toBe(800);
  });
});
