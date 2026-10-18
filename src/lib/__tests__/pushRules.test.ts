import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint, parsePushSubscription, safePushUrl } from '@/lib/pushRules';

describe('isAllowedPushEndpoint', () => {
  it('aceita os serviços de push dos navegadores', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc123')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QGx1')).toBe(true);
    expect(isAllowedPushEndpoint('https://api.push.apple.com/3/device/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://wns2-bl2p.notify.windows.com/w/?token=abc')).toBe(true);
  });

  it('recusa qualquer outro endereço', () => {
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://evil.com/fcm.googleapis.com')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://user:pw@fcm.googleapis.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://169.254.169.254/latest')).toBe(false);
    expect(isAllowedPushEndpoint('não é url')).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${'a'.repeat(1000)}`)).toBe(false);
  });
});

describe('parsePushSubscription', () => {
  const valid = {
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
    },
  };

  it('aceita o formato do PushSubscription.toJSON()', () => {
    const parsed = parsePushSubscription(valid);
    expect(parsed.ok).toBe(true);
  });

  it('recusa chaves inválidas ou endpoint de fora', () => {
    expect(parsePushSubscription({}).ok).toBe(false);
    expect(
      parsePushSubscription({ subscription: { ...valid.subscription, keys: { p256dh: 'a b', auth: 'x' } } }).ok
    ).toBe(false);
    expect(
      parsePushSubscription({ subscription: { ...valid.subscription, endpoint: 'https://localhost/x' } }).ok
    ).toBe(false);
  });
});

describe('safePushUrl', () => {
  it('só deixa caminho interno', () => {
    expect(safePushUrl('/agenda')).toBe('/agenda');
    expect(safePushUrl(undefined)).toBe('/');
    expect(safePushUrl('https://evil.com')).toBe('/');
    expect(safePushUrl('//evil.com')).toBe('/');
    expect(safePushUrl('/\\evil.com')).toBe('/');
  });
});
