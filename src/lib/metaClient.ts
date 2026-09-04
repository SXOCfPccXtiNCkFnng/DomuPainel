/**
 * Domu Tech - Meta Cloud API Server Helper
 * Prefer tenant credentials; fallback to env global.
 */

import { supabaseAdmin } from '@/lib/supabaseServer';
import { decryptData } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export type MetaCredentials = {
  accessToken: string;
  phoneNumberId: string;
  source: 'tenant' | 'env';
};

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
  credentials?: MetaCredentials;
  tenantId?: string;
}

export interface SendTextOptions {
  to: string;
  textBody: string;
  credentials?: MetaCredentials;
  tenantId?: string;
}

const META_GRAPH_API_VERSION = 'v20.0';

function envMetaCredentials(): MetaCredentials | null {
  const accessToken = process.env.META_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId, source: 'env' };
}

/** Credenciais do tenant (criptografadas) com fallback para env global. */
export async function resolveMetaCredentials(tenantId?: string): Promise<MetaCredentials> {
  if (tenantId) {
    const { data: cred } = await supabaseAdmin
      .from('tenant_credentials')
      .select('phone_number_id, encrypted_access_token, token_encryption_iv')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (
      cred?.phone_number_id &&
      cred.encrypted_access_token &&
      cred.token_encryption_iv
    ) {
      try {
        const accessToken = decryptData(cred.encrypted_access_token, cred.token_encryption_iv);
        if (accessToken) {
          return {
            accessToken,
            phoneNumberId: cred.phone_number_id,
            source: 'tenant',
          };
        }
      } catch (err: any) {
        logger.warn('meta.decrypt_failed', {
          tenantId,
          message: err?.message,
        });
      }
    }
  }

  const fromEnv = envMetaCredentials();
  if (fromEnv) return fromEnv;

  throw new Error(
    'Credenciais Meta ausentes. Configure em Configurações do WhatsApp ou META_ACCESS_TOKEN / META_PHONE_NUMBER_ID no ambiente.'
  );
}

async function resolveCreds(options: {
  credentials?: MetaCredentials;
  tenantId?: string;
}): Promise<MetaCredentials> {
  if (options.credentials) return options.credentials;
  return resolveMetaCredentials(options.tenantId);
}

export async function sendMetaTemplate({
  to,
  templateName,
  languageCode = 'en_US',
  components = [],
  credentials,
  tenantId,
}: SendTemplateOptions) {
  const creds = await resolveCreds({ credentials, tenantId });
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${creds.phoneNumberId}/messages`;
  const sanitizedTo = to.replace(/\D/g, '');

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: sanitizedTo,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (components && components.length > 0) {
    payload.template.components = components;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('meta.template_failed', {
      status: response.status,
      source: creds.source,
      error: data?.error?.message,
    });
    return {
      success: false,
      status: response.status,
      error: data.error || { message: 'Meta API call failed' },
    };
  }

  return {
    success: true,
    status: response.status,
    messageId: data.messages?.[0]?.id,
    data,
    credentialsSource: creds.source,
  };
}

export async function sendMetaText({
  to,
  textBody,
  credentials,
  tenantId,
}: SendTextOptions) {
  const creds = await resolveCreds({ credentials, tenantId });
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${creds.phoneNumberId}/messages`;
  const sanitizedTo = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: sanitizedTo,
    type: 'text',
    text: {
      preview_url: false,
      body: textBody,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('meta.text_failed', {
      status: response.status,
      source: creds.source,
      error: data?.error?.message,
    });
    return {
      success: false,
      status: response.status,
      error: data.error || { message: 'Meta API call failed' },
    };
  }

  return {
    success: true,
    status: response.status,
    messageId: data.messages?.[0]?.id,
    data,
    credentialsSource: creds.source,
  };
}

export type PhoneNumberQuality = {
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messagingLimitTier: string | null;
  nameStatus: string | null;
  displayPhoneNumber: string | null;
};

/**
 * Consulta o status da conta WhatsApp na Meta (qualidade, limite de disparo, nome verificado).
 * Uma conta YELLOW/RED tem o limite de envio reduzido pela Meta e pode ser suspensa.
 */
export async function getPhoneNumberQuality(
  credentials: Pick<MetaCredentials, 'accessToken' | 'phoneNumberId'>
): Promise<PhoneNumberQuality> {
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${credentials.phoneNumberId}?fields=quality_rating,messaging_limit_tier,name_status,display_phone_number`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Falha ao consultar qualidade do número na Meta.');
  }

  const rating = String(data.quality_rating || 'UNKNOWN').toUpperCase();
  return {
    qualityRating: rating === 'GREEN' || rating === 'YELLOW' || rating === 'RED' ? rating : 'UNKNOWN',
    messagingLimitTier: data.messaging_limit_tier || null,
    nameStatus: data.name_status || null,
    displayPhoneNumber: data.display_phone_number || null,
  };
}

/** Detecta pedido de opt-out em texto inbound. */
export function isOptOutMessage(text: string): boolean {
  const t = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    /nao quero receber/.test(t) ||
    /parar de (receber|enviar)/.test(t) ||
    /\b(stop|unsubscribe|sair|cancelar)\b/.test(t) ||
    /remover (meu )?(numero|telefone)/.test(t)
  );
}
