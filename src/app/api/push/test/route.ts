import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { sendPushToUsers } from '@/lib/push';

export const dynamic = 'force-dynamic';

/** Manda uma notificação de teste para os aparelhos do próprio usuário. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const delivered = await sendPushToUsers([auth.session.userId], auth.session.tenantId, {
      title: 'Notificações ativadas',
      body: 'Pronto! Você vai receber os avisos do painel aqui no celular.',
      url: '/',
      tag: 'push-test',
    });
    if (!delivered) {
      return NextResponse.json(
        { success: false, error: 'Nenhum aparelho recebeu. Desative e ative de novo neste aparelho.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, delivered });
  } catch (error: unknown) {
    return internalErrorResponse('api.push.test', error);
  }
}
