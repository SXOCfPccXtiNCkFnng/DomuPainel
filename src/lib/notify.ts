import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { sendPushToUsers } from '@/lib/push';

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

type NotificationInput = {
  title: string;
  message: string;
  type?: NotificationType;
  /** Página aberta ao tocar na notificação do celular (caminho interno, ex.: '/agenda'). */
  url?: string;
};

/** Cria uma notificação (sino do Header + celular, se ativado) pra um ou mais usuários específicos. */
export async function notifyUsers(userIds: string[], tenantId: string, input: NotificationInput): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    await supabaseAdmin.from('notifications').insert(
      ids.map((userId) => ({
        tenant_id: tenantId,
        user_id: userId,
        title: input.title.slice(0, 255),
        message: input.message.slice(0, 2000),
        type: input.type || 'INFO',
      }))
    );
  } catch (err) {
    // Notificação é best-effort — nunca deve quebrar o fluxo principal (ex.: dispatch de campanha).
    logger.error('notify.insert_failed', { message: err instanceof Error ? err.message : String(err) });
  }

  try {
    await sendPushToUsers(ids, tenantId, { title: input.title, body: input.message, url: input.url });
  } catch (err) {
    logger.error('notify.push_failed', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Notifica todos os administradores de um tenant. */
export async function notifyTenantAdmins(tenantId: string, input: NotificationInput): Promise<void> {
  const { data: admins } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'ADMIN');

  await notifyUsers((admins || []).map((a) => a.id), tenantId, input);
}
