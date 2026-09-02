import { describe, expect, it } from 'vitest';
import { isPasswordStrong } from '../authHelpers';
import { checkRateLimit } from '../rateLimit';
import {
  getPlanMonthlyLimit,
  getPlanUserLimit,
  normalizePlanTier,
} from '../planLimits';
import { hashToken, generateSecureToken } from '../email';

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
