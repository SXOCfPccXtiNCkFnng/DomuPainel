import { NextRequest, NextResponse } from 'next/server';
import { sendMetaTemplate, sendMetaText } from '@/lib/metaClient';
import { requireAuth } from '@/lib/requireAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { to, type = 'template', templateName, languageCode = 'en_US', textBody, components } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'O parâmetro "to" (número de telefone) é obrigatório.' },
        { status: 400 }
      );
    }

    if (type === 'template') {
      if (!templateName) {
        return NextResponse.json(
          { success: false, error: 'O nome do template ("templateName") é obrigatório para disparos do tipo template.' },
          { status: 400 }
        );
      }

      const result = await sendMetaTemplate({
        to,
        templateName,
        languageCode,
        components
      });

      if (!result.success) {
        return NextResponse.json(result, { status: result.status || 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Mensagem de template disparada com sucesso via Meta Cloud API!',
        messageId: result.messageId,
        data: result.data
      });
    }

    if (type === 'text') {
      if (!textBody) {
        return NextResponse.json(
          { success: false, error: 'O texto da mensagem ("textBody") é obrigatório.' },
          { status: 400 }
        );
      }

      const result = await sendMetaText({ to, textBody });

      if (!result.success) {
        return NextResponse.json(result, { status: result.status || 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Mensagem de texto enviada com sucesso via Meta Cloud API!',
        messageId: result.messageId,
        data: result.data
      });
    }

    return NextResponse.json(
      { success: false, error: 'Tipo de mensagem inválido. Use "template" ou "text".' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[API Send Route Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao processar disparo.' },
      { status: 500 }
    );
  }
}
