/**
 * Regras puras do web push (sem rede): o servidor faz POST no endpoint que o
 * navegador registrou, então só aceita os serviços de push dos navegadores —
 * nunca um endereço qualquer escolhido por quem chamou a API.
 */
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
];
const PUSH_SERVICE_SUFFIXES = ['.push.apple.com', '.notify.windows.com'];

export const PUSH_ENDPOINT_MAX = 1000;

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (!endpoint || endpoint.length > PUSH_ENDPOINT_MAX) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.includes(host) || PUSH_SERVICE_SUFFIXES.some((s) => host.endsWith(s));
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Corpo do POST de inscrição → dados validados (formato do PushSubscription.toJSON()). */
export function parsePushSubscription(
  body: unknown
): { ok: true; subscription: PushSubscriptionInput } | { ok: false; error: string } {
  const sub = (body as { subscription?: unknown })?.subscription as
    | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    | undefined;
  const endpoint = String(sub?.endpoint ?? '');
  const p256dh = String(sub?.keys?.p256dh ?? '');
  const auth = String(sub?.keys?.auth ?? '');
  if (!isAllowedPushEndpoint(endpoint)) return { ok: false, error: 'Serviço de notificação não reconhecido.' };
  if (!BASE64URL.test(p256dh) || p256dh.length > 200 || !BASE64URL.test(auth) || auth.length > 100) {
    return { ok: false, error: 'Inscrição de notificação inválida.' };
  }
  return { ok: true, subscription: { endpoint, p256dh, auth } };
}

/** Link aberto ao tocar na notificação: só caminho interno do painel. */
export function safePushUrl(url: string | undefined): string {
  return url && /^\/(?![/\\])/.test(url) ? url : '/';
}
