import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  currentStep,
  formatSecretForDisplay,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  otpauthUrl,
  totpCode,
  verifyTotp,
} from '../totp';

// Segredo dos vetores de teste da RFC 6238 (SHA1): "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('gera os códigos oficiais da norma', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totpCode(RFC_SECRET, currentStep(59 * 1000))).toBe('287082');
    expect(totpCode(RFC_SECRET, currentStep(1111111109 * 1000))).toBe('081804');
    expect(totpCode(RFC_SECRET, currentStep(1234567890 * 1000))).toBe('005924');
  });

  it('base32 vai e volta', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Decode(formatSecretForDisplay(secret).toLowerCase()).equals(base32Decode(secret))).toBe(true);
  });

  it('aceita o código atual e o vizinho (relógio do celular), e recusa o resto', () => {
    const now = 1_800_000_000_000;
    const step = currentStep(now);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 3), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, '12345', { now })).toBeNull();
  });

  it('o mesmo código não vale duas vezes', () => {
    const now = 1_800_000_000_000;
    const step = currentStep(now);
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step - 1 })).toBe(step);
  });

  it('link do aplicativo autenticador', () => {
    const url = otpauthUrl({ issuer: 'Domu Tech', account: 'ana@loja.com', secret: RFC_SECRET });
    expect(url.startsWith('otpauth://totp/Domu%20Tech%3Aana%40loja.com?')).toBe(true);
    expect(url).toContain(`secret=${RFC_SECRET}`);
    expect(url).toContain('issuer=Domu+Tech');
  });
});

describe('códigos de recuperação', () => {
  it('8 códigos diferentes no formato xxxx-xxxx', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
  });

  it('aceita digitado com maiúscula, espaço ou sem traço', () => {
    expect(normalizeRecoveryCode(' AB2C-DE3F ')).toBe('ab2cde3f');
    expect(normalizeRecoveryCode('ab2cde3f')).toBe('ab2cde3f');
  });
});
