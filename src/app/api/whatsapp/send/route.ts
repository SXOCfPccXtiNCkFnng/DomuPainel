import { NextRequest, NextResponse } from 'next/server';
import { sendMetaTemplate, sendMetaText } from '@/lib/metaClient';
import { requireDispatcher } from '@/lib/requireAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Envio avulso para um contato do próprio tenant.
 * Travas: papel de disparo, assinatura ativa, só para leads cadastrados
 * (nunca número arbitrário), opt-out e rate limit por tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const limit = checkRateLimit(`whatsapp-send:${tenantId}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitos envios em sequência. Aguarde um minuto.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec || 60) } }
      );
    }

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!isSubscriptionAllowedToDispatch(subscription?.status)) {
      return NextResponse.json(
        { success: false, error: 'Assinatura inativa ou vencida. Regularize em Assinatura para enviar mensagens.' },
        { status: 402 }
      );
    }

    const body = await req.json();
    const {
      to,
      type = 'template',
      templateName,
      languageCode = 'en_US',
      textBody,
      components,
    } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'O parâmetro "to" (número de telefone) é obrigatório.' },
        { status: 400 }
      );
    }

    const phoneDigits = String(to).replace(/\D/g, '');
    const phones = [phoneDigits];
    if (phoneDigits.startsWith('55') && phoneDigits.length > 11) phones.push(phoneDigits.slice(2));
    else if (phoneDigits.length <= 11) phones.push(`55${phoneDigits}`);

    // Sem .maybeSingle(): com 2 cadastros do mesmo número ele dá erro, `lead`
    // vira null e o opt-out era ignorado. Qualquer cadastro com opt-out bloqueia.
    const { data: leads, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('id, opt_in')
      .eq('tenant_id', tenantId)
      .in('phone', phones);
    if (leadError) throw leadError;

    if (!leads || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Este número não está nos seus contatos. Cadastre o contato antes de enviar.' },
        { status: 404 }
      );
    }

    if (leads.some((lead) => lead.opt_in === false)) {
      return NextResponse.json(
        { success: false, error: 'Este contato pediu para não receber mensagens (opt-out).' },
        { status: 403 }
      );
    }

    if (type === 'template') {
      if (!templateName) {
        return NextResponse.json(
          {
            success: false,
            error: 'O nome do template ("templateName") é obrigatório para disparos do tipo template.',
          },
          { status: 400 }
        );
      }

      const result = await sendMetaTemplate({
        to,
        templateName,
        languageCode,
        components,
        tenantId,
      });

      if (!result.success) {
        return NextResponse.json(result, { status: result.status || 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Mensagem de template disparada com sucesso via Meta Cloud API!',
        messageId: result.messageId,
        data: result.data,
      });
    }

    if (type === 'text') {
      if (!textBody) {
        return NextResponse.json(
          { success: false, error: 'O texto da mensagem ("textBody") é obrigatório.' },
          { status: 400 }
        );
      }

      const result = await sendMetaText({ to, textBody, tenantId });

      if (!result.success) {
        return NextResponse.json(result, { status: result.status || 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Mensagem de texto enviada com sucesso via Meta Cloud API!',
        messageId: result.messageId,
        data: result.data,
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
