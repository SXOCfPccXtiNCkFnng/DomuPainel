import { describe, expect, it } from 'vitest';
import { isPasswordStrong } from '../authHelpers';
import { checkRateLimit } from '../rateLimit';
import {
  getPlanMonthlyLimit,
  getPlanUserLimit,
  normalizePlanTier,
} from '../planLimits';
import { hashToken, generateSecureToken } from '../email';
import { isValidBrazilianPhone, isValidCpfCnpjLength } from '../validators';

describe('isPasswordStrong', () => {
  it('rejects short passwords', () => {
    expect(isPasswordStrong('Ab1!').valid).toBe(false);
  });

  it('accepts strong passwords', () => {
    expect(isPasswordStrong('SenhaForte1!').valid).toBe(true);
  });
});

describe('rateLimit', () => {
  it('blocks after limit', () => {
    const key = `test:${Date.now()}`;
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).ok).toBe(false);
  });
});

describe('planLimits', () => {
  it('normalizes unknown tiers to STARTER', () => {
    expect(normalizePlanTier('xyz')).toBe('STARTER');
    expect(getPlanMonthlyLimit('STARTER')).toBe(1500);
    expect(getPlanUserLimit('PRO')).toBe(10);
  });
});

describe('email tokens', () => {
  it('hashes deterministically', () => {
    const token = generateSecureToken(16);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});

describe('100% coupon', () => {
  it('zeros the price', async () => {
    const { computeSubscriptionPrice } = await import('../billing');
    const price = computeSubscriptionPrice({
      planTier: 'STARTER',
      paymentMethod: 'PIX',
      coupon: { code: 'TESTE100', percent_off: 100, amount_off_brl: null },
    });
    expect(price.finalPrice).toBe(0);
  });
});

describe('isValidBrazilianPhone', () => {
  it('accepts mobile and landline numbers with DDD', () => {
    expect(isValidBrazilianPhone('11987654321')).toBe(true);
    expect(isValidBrazilianPhone('1132345678')).toBe(true);
    expect(isValidBrazilianPhone('(11) 98765-4321')).toBe(true);
  });

  it('accepts numbers with the 55 country code', () => {
    expect(isValidBrazilianPhone('5511987654321')).toBe(true);
  });

  it('rejects garbage input', () => {
    expect(isValidBrazilianPhone('')).toBe(false);
    expect(isValidBrazilianPhone('abc')).toBe(false);
    expect(isValidBrazilianPhone('123')).toBe(false);
  });
});

describe('isValidCpfCnpjLength', () => {
  it('accepts 11 (CPF) or 14 (CNPJ) digit values', () => {
    expect(isValidCpfCnpjLength('123.456.789-00')).toBe(true);
    expect(isValidCpfCnpjLength('12.345.678/0001-00')).toBe(true);
  });

  it('rejects other lengths', () => {
    expect(isValidCpfCnpjLength('123')).toBe(false);
    expect(isValidCpfCnpjLength('')).toBe(false);
  });
});

describe('platformAdmin emails', () => {
  it('parses allowlist and ignores junk', async () => {
    const prev = process.env.PLATFORM_ADMIN_EMAILS;
    const { parsePlatformAdminEmails, isPlatformAdminEmail } = await import('../platformAdmin');
    expect(parsePlatformAdminEmails('A@X.com, b@y.com ;')).toEqual(['a@x.com', 'b@y.com']);
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@domutech.digital';
    expect(isPlatformAdminEmail('OPS@domutech.digital')).toBe(true);
    expect(isPlatformAdminEmail('outro@empresa.com')).toBe(false);
    if (prev === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = prev;
  });
});
