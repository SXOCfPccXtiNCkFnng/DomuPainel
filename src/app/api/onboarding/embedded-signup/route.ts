import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/requireAuth';
import { encryptData } from '@/lib/crypto';
import { generateSecureToken } from '@/lib/email';
import { isValidBrazilianPhone } from '@/lib/validators';
import { getMetaAppSecret } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const META_API_VERSION = 'v21.0';

/**
 * Troca o código do WhatsApp Embedded Signup (JS SDK popup) por um Business
 * Integration System User access token. O código expira em ~30s — chamar
 * assim que o cliente recebe a resposta do FB.login.
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
 */
async function exchangeCodeForToken(code: string): Promise<{ accessToken: string }> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) {
    throw new Error('NEXT_PUBLIC_META_APP_ID / META_APP_SECRET não configurados no servidor.');
  }

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('grant_type', 'authorization_code');
  url.searchParams.set('code', code);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(data?.error?.message || 'Falha ao trocar o código pelo token da Meta.');
  }

  return { accessToken: data.access_token as string };
}

/** Ativa o número pra Cloud API. Números vindos do app WhatsApp Business (coexistência)
 * podem já vir prontos, então falha aqui não derruba o fluxo — só vira aviso. */
async function registerPhoneNumber(
  phoneNumberId: string,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/register`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || 'register falhou' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'register falhou' };
  }
}

/** Assina o app nos webhooks da WABA do cliente (mensagens, status etc.). */
async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || 'subscribed_apps falhou' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'subscribed_apps falhou' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const {
      code,
      wabaId,
      phoneNumberId,
      whatsappPhone,
      companyName,
      segment,
      ownerName,
      cityState,
    } = body;

    if (!code || !wabaId || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltou code, wabaId ou phoneNumberId do Embedded Signup da Meta.',
        },
        { status: 400 }
      );
    }

    if (whatsappPhone && !isValidBrazilianPhone(whatsappPhone)) {
      return NextResponse.json(
        { success: false, error: 'Informe um número de WhatsApp válido, com DDD (ex: 11 98765-4321).' },
        { status: 400 }
      );
    }

    let accessToken: string;
    try {
      const exchanged = await exchangeCodeForToken(String(code));
      accessToken = exchanged.accessToken;
    } catch (err) {
      logger.error('onboarding.embedded_signup_token_exchange_failed', {
        tenantId,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Falha ao validar a autorização da Meta. Tente conectar novamente.',
        },
        { status: 502 }
      );
    }

    const warnings: string[] = [];

    const registerResult = await registerPhoneNumber(String(phoneNumberId), accessToken);
    if (!registerResult.ok) {
      warnings.push(`Registro do número: ${registerResult.error}`);
      logger.warn('onboarding.embedded_signup_register_warning', {
        tenantId,
        error: registerResult.error,
      });
    }

    const subscribeResult = await subscribeAppToWaba(String(wabaId), accessToken);
    if (!subscribeResult.ok) {
      warnings.push(`Assinatura de webhooks: ${subscribeResult.error}`);
      logger.warn('onboarding.embedded_signup_subscribe_warning', {
        tenantId,
        error: subscribeResult.error,
      });
    }

    const { encryptedText, iv } = encryptData(accessToken);

    const { data: existingCred } = await supabaseAdmin
      .from('tenant_credentials')
      .select('verify_token')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const verifyToken = existingCred?.verify_token || generateSecureToken(16);

    const { error: credError } = await supabaseAdmin.from('tenant_credentials').upsert(
      {
        tenant_id: tenantId,
        waba_id: String(wabaId),
        phone_number_id: String(phoneNumberId),
        encrypted_access_token: encryptedText,
        token_encryption_iv: iv,
        verify_token: verifyToken,
        app_id: process.env.NEXT_PUBLIC_META_APP_ID || null,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.domutech.digital'}/api/whatsapp/webhook`,
        is_verified: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    if (credError) {
      logger.error('onboarding.embedded_signup_save_failed', {
        tenantId,
        message: credError.message,
      });
      return NextResponse.json(
        { success: false, error: 'Falha ao salvar as credenciais Meta no banco.' },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('tenants')
      .update({
        name: companyName || undefined,
        segment: segment || undefined,
        whatsapp_number: whatsappPhone || '',
        coexistence_status: 'CONNECTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (ownerName) {
      await supabaseAdmin
        .from('users')
        .update({ name: ownerName, phone: whatsappPhone || undefined, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('role', 'ADMIN');
    }

    logger.info('onboarding.embedded_signup_connected', { tenantId, wabaId, phoneNumberId, warnings });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp conectado via Meta Embedded Signup.',
      wabaId,
      phoneNumberId,
      verifyToken,
      cityState: cityState || null,
      warnings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno.';
    logger.error('onboarding.embedded_signup_error', { message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
