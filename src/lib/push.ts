/**
 * Envio de notificações para o celular (web push). Best-effort: falha aqui
 * nunca derruba quem chamou — a notificação do sino já foi gravada.
 */
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { safePushUrl } from '@/lib/pushRules';

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let vapidReady: boolean | null = null;

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const publicKey = pushPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@domutech.digital', publicKey, privateKey);
    vapidReady = true;
  } catch (err) {
    logger.error('push.vapid_invalid', { message: err instanceof Error ? err.message : String(err) });
    vapidReady = false;
  }
  return vapidReady;
}

export function isPushConfigured(): boolean {
  return ensureVapid();
}

/** Manda para todos os aparelhos em que esses usuários ativaram notificações. Retorna quantos receberam. */
export async function sendPushToUsers(userIds: string[], tenantId: string, payload: PushPayload): Promise<number> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length || !ensureVapid()) return 0;

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)
    .in('user_id', ids);
  if (error) {
    // Migration ainda não rodou: sem aparelhos para notificar.
    if (error.code !== '42P01') logger.error('push.load_failed', { message: error.message });
    return 0;
  }
  if (!subs?.length) return 0;

  const body = JSON.stringify({
    title: payload.title.slice(0, 120),
    body: payload.body.slice(0, 300),
    url: safePushUrl(payload.url),
    tag: payload.tag,
  });

  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 24 * 60 * 60, urgency: 'high', timeout: 10_000 }
        );
        return { id: s.id, ok: true };
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: o aparelho desativou ou a inscrição expirou — não adianta tentar de novo.
        if (status === 404 || status === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          logger.warn('push.send_failed', { status, message: err instanceof Error ? err.message : String(err) });
        }
        return { id: s.id, ok: false };
      }
    })
  );

  const delivered = results.filter((r) => r.ok).map((r) => r.id);
  if (delivered.length) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .in('id', delivered);
  }
  return delivered.length;
}
