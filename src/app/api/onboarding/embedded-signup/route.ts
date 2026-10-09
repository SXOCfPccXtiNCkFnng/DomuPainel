import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/requireAuth';
import { encryptData } from '@/lib/crypto';
import { generateSecureToken } from '@/lib/email';
import { isValidBrazilianPhone } from '@/lib/validators';
import { getMetaAppSecret } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';
import { pickOnboardedPhone, type ListedWhatsappPhone } from '@/lib/metaSignupPhone';
import { META_GRAPH_API_VERSION, metaFetch, subscribeAppToWaba } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';



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

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('grant_type', 'authorization_code');
  url.searchParams.set('code', code);

  const res = await metaFetch(url.toString());
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
    const pin = String(randomInt(100000, 1000000));
    const res = await metaFetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/register`,
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

type MetaPhoneRow = { id?: string; display_phone_number?: string };

/** Lista os números da WABA. Coexistência muitas vezes não devolve phone_number_id no popup. */
async function listWabaPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<ListedWhatsappPhone[]> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${wabaId}/phone_numbers`);
  url.searchParams.set('fields', 'id,display_phone_number');
  url.searchParams.set('limit', '50');

  const res = await metaFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Não foi possível listar os números da conta WhatsApp.');
  }

  const rows: MetaPhoneRow[] = Array.isArray(data?.data) ? data.data : [];
  return rows
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      wabaId,
      displayPhoneNumber: row.display_phone_number || null,
    }));
}

/** WABAs concedidas ao token, quando o popup não manda waba_id. */
async function listWabaIdsFromToken(accessToken: string): Promise<string[]> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) {
    throw new Error('NEXT_PUBLIC_META_APP_ID / META_APP_SECRET não configurados no servidor.');
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/debug_token`);
  url.searchParams.set('input_token', accessToken);
  const res = await metaFetch(url.toString(), {
    headers: { Authorization: `Bearer ${appId}|${appSecret}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Não foi possível ler a conta autorizada na Meta.');
  }

  const scopes = Array.isArray(data?.data?.granular_scopes) ? data.data.granular_scopes : [];
  const ids = new Set<string>();
  for (const scope of scopes) {
    if (scope?.scope !== 'whatsapp_business_management') continue;
    const targets = Array.isArray(scope.target_ids) ? scope.target_ids : [];
    for (const id of targets) {
      if (id) ids.add(String(id));
    }
  }
  return [...ids];
}

/**
 * Garante waba_id e phone_number_id antes de marcar a conta como conectada.
 * Se o popup da coexistência omitir o número, busca em GET /{waba}/phone_numbers.
 */
async function resolveSignupIds(input: {
  accessToken: string;
  wabaId?: string;
  phoneNumberId?: string;
  whatsappPhone?: string;
}): Promise<{ wabaId: string; phoneNumberId: string; lookedUpPhone: boolean }> {
  const givenWaba = input.wabaId?.trim() || '';
  const givenPhone = input.phoneNumberId?.trim() || '';

  if (givenWaba && givenPhone) {
    // IDs vieram do navegador: confirma na Meta que o token autorizado tem
    // acesso a essa WABA e que o número é dela. Sem isso dava para gravar o
    // phone_number_id de outro cliente e desviar as mensagens recebidas dele.
    const phones = await listWabaPhoneNumbers(givenWaba, input.accessToken);
    if (!phones.some((phone) => phone.id === givenPhone)) {
      throw new Error(
        'A Meta confirmou a conta, mas o número informado não pertence a ela. Tente conectar de novo.'
      );
    }
    return { wabaId: givenWaba, phoneNumberId: givenPhone, lookedUpPhone: false };
  }

  const wabaIds = givenWaba ? [givenWaba] : await listWabaIdsFromToken(input.accessToken);
  const listed: ListedWhatsappPhone[] = [];
  for (const wabaId of wabaIds) {
    const phones = await listWabaPhoneNumbers(wabaId, input.accessToken);
    listed.push(...phones);
  }

  if (givenPhone) {
    const match = listed.find((phone) => phone.id === givenPhone);
    // O número tem que estar entre os que o token enxerga (mesma razão acima).
    const wabaId = match?.wabaId || '';
    if (!wabaId) {
      throw new Error(
        'A Meta confirmou o número, mas não informou a conta do WhatsApp. Tente conectar de novo.'
      );
    }
    return { wabaId, phoneNumberId: givenPhone, lookedUpPhone: false };
  }

  const picked = pickOnboardedPhone(listed, input.whatsappPhone);
  if (picked === 'none') {
    throw new Error(
      'A Meta confirmou a conta, mas não encontramos o número do WhatsApp Business. Confira se o aplicativo verde está aberto nesse número e tente de novo.'
    );
  }
  if (picked === 'ambiguous') {
    throw new Error(
      'A Meta confirmou a conta, mas há mais de um número e nenhum bate com o WhatsApp informado no cadastro. Volte e confira se digitou o número do aplicativo verde.'
    );
  }

  return { wabaId: picked.wabaId, phoneNumberId: picked.id, lookedUpPhone: true };
}

/** Busca o número de telefone real na Meta (mais confiável que confiar no que o cliente digitou). */
async function fetchDisplayPhoneNumber(
  phoneNumberId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const res = await metaFetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return res.ok ? data.display_phone_number || null : null;
  } catch {
    return null;
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

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltou o código de autorização do Embedded Signup da Meta.',
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

    let resolvedWabaId: string;
    let resolvedPhoneNumberId: string;
    try {
      const resolved = await resolveSignupIds({
        accessToken,
        wabaId: wabaId ? String(wabaId) : undefined,
        phoneNumberId: phoneNumberId ? String(phoneNumberId) : undefined,
        whatsappPhone: whatsappPhone ? String(whatsappPhone) : undefined,
      });
      resolvedWabaId = resolved.wabaId;
      resolvedPhoneNumberId = resolved.phoneNumberId;
      if (resolved.lookedUpPhone) {
        logger.info('onboarding.embedded_signup_phone_resolved', {
          tenantId,
          wabaId: resolvedWabaId,
          phoneNumberId: resolvedPhoneNumberId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível identificar o número na Meta.';
      const customerCanRetry = message.startsWith('A Meta confirmou');
      logger.warn('onboarding.embedded_signup_resolve_failed', { tenantId, message });
      return NextResponse.json(
        { success: false, error: message },
        { status: customerCanRetry ? 400 : 502 }
      );
    }

    // Um número só pode estar ligado a uma conta Domu: o webhook encontra o dono
    // da mensagem pelo phone_number_id.
    const { data: otherOwner } = await supabaseAdmin
      .from('tenant_credentials')
      .select('tenant_id')
      .eq('phone_number_id', resolvedPhoneNumberId)
      .neq('tenant_id', tenantId)
      .limit(1);
    if (otherOwner && otherOwner.length > 0) {
      logger.warn('onboarding.embedded_signup_phone_taken', { tenantId, phoneNumberId: resolvedPhoneNumberId });
      return NextResponse.json(
        {
          success: false,
          error:
            'Este número de WhatsApp já está conectado a outra conta da Domu. Fale com o suporte se ele é seu.',
        },
        { status: 409 }
      );
    }

    // Número oficial da Meta para este phone_number_id. É ele que vai para o
    // cadastro (nunca o digitado) e é com ele que todo envio é conferido depois.
    const realPhoneNumber = await fetchDisplayPhoneNumber(resolvedPhoneNumberId, accessToken);
    if (!realPhoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'A Meta não confirmou o número do WhatsApp agora. Tente conectar de novo em instantes.',
        },
        { status: 502 }
      );
    }

    const warnings: string[] = [];

    const registerResult = await registerPhoneNumber(resolvedPhoneNumberId, accessToken);
    if (!registerResult.ok) {
      warnings.push(`Registro do número: ${registerResult.error}`);
      logger.warn('onboarding.embedded_signup_register_warning', {
        tenantId,
        error: registerResult.error,
      });
    }

    const subscribeResult = await subscribeAppToWaba(resolvedWabaId, accessToken);
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
        waba_id: resolvedWabaId,
        phone_number_id: resolvedPhoneNumberId,
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

    const resolvedPhone = realPhoneNumber;

    await supabaseAdmin
      .from('tenants')
      .update({
        name: companyName || undefined,
        segment: segment || undefined,
        whatsapp_number: resolvedPhone,
        coexistence_status: 'CONNECTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (ownerName) {
      await supabaseAdmin
        .from('users')
        .update({ name: ownerName, phone: resolvedPhone, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('role', 'ADMIN');
    }

    logger.info('onboarding.embedded_signup_connected', {
      tenantId,
      wabaId: resolvedWabaId,
      phoneNumberId: resolvedPhoneNumberId,
      warnings,
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp conectado via Meta Embedded Signup.',
      wabaId: resolvedWabaId,
      phoneNumberId: resolvedPhoneNumberId,
      whatsappPhone: resolvedPhone || null,
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
