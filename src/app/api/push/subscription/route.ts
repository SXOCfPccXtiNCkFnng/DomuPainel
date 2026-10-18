import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { isPushConfigured, pushPublicKey } from '@/lib/push';
import { parsePushSubscription } from '@/lib/pushRules';
import { isSchemaPendingError } from '@/lib/schedulingServer';

export const dynamic = 'force-dynamic';

const MIGRATION_PENDING = 'Notificações no celular ainda não liberadas: falta rodar a migration 20261019_push_subscriptions.';

/** Chave pública para o navegador se inscrever (null = servidor sem chaves VAPID). */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;
  return NextResponse.json({ success: true, publicKey: isPushConfigured() ? pushPublicKey() : null });
}

/** Ativa as notificações neste aparelho para o usuário logado. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const parsed = parsePushSubscription(await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const { endpoint, p256dh, auth: authKey } = parsed.subscription;
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        tenant_id: auth.session.tenantId,
        user_id: auth.session.userId,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: (req.headers.get('user-agent') || '').slice(0, 300) || null,
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) {
      return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
    }
    return internalErrorResponse('api.push.subscription.post', error);
  }
}

/** Desativa as notificações neste aparelho. */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
    const endpoint = String(body.endpoint ?? '');
    if (!endpoint) return NextResponse.json({ success: false, error: 'Informe o aparelho.' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', auth.session.userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return NextResponse.json({ success: true });
    return internalErrorResponse('api.push.subscription.delete', error);
  }
}
