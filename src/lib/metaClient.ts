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
  wabaId?: string;
  source: 'tenant' | 'env';
};

/**
 * Envio exige credenciais JÁ verificadas (requireVerifiedWhatsApp) — não há
 * mais resolução implícita aqui, para nenhum caminho enviar por número errado.
 */
export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
  credentials: MetaCredentials;
}

export interface SendTextOptions {
  to: string;
  textBody: string;
  credentials: MetaCredentials;
}

/**
 * Versão única da Graph API para todo o backend. A Meta mantém cada versão
 * por ~2 anos; ao subir, confira o changelog e troque só aqui.
 */
export const META_GRAPH_API_VERSION = 'v21.0';
/** Sem timeout, uma chamada travada na Meta segura o lote de disparo além do maxDuration. */
const META_TIMEOUT_MS = 15_000;

export function metaFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(META_TIMEOUT_MS) });
}

function envMetaCredentials(): MetaCredentials | null {
  const accessToken = process.env.META_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const wabaId = process.env.META_WABA_ID || undefined;
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId, wabaId, source: 'env' };
}

/**
 * Credenciais do tenant (criptografadas). Para ENVIAR use requireVerifiedWhatsApp
 * (whatsappConnection.ts), que além disso confere o número na Meta.
 * Sem fallback para as credenciais globais quando há tenant: um cliente sem
 * WhatsApp conectado dispararia pelo número de OUTRA conta.
 */
export async function resolveMetaCredentials(tenantId?: string): Promise<MetaCredentials> {
  if (tenantId) {
    const { data: cred } = await supabaseAdmin
      .from('tenant_credentials')
      .select('phone_number_id, waba_id, encrypted_access_token, token_encryption_iv')
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
            wabaId: cred.waba_id || undefined,
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

  // Com tenant: NUNCA cai nas credenciais globais (nem em dev) — cliente sem
  // WhatsApp próprio não envia. O env só serve para chamadas sem tenant.
  const fromEnv = tenantId ? null : envMetaCredentials();
  if (fromEnv) return fromEnv;

  throw new Error(
    'WhatsApp não conectado nesta conta. Conecte em Configurações → Integração WhatsApp.'
  );
}

export async function sendMetaTemplate({
  to,
  templateName,
  languageCode = 'en_US',
  components = [],
  credentials,
}: SendTemplateOptions) {
  if (!credentials?.accessToken || !credentials.phoneNumberId) {
    throw new Error('Envio bloqueado: credenciais do WhatsApp não verificadas.');
  }
  const creds = credentials;
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

  const response = await metaFetch(url, {
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
}: SendTextOptions) {
  if (!credentials?.accessToken || !credentials.phoneNumberId) {
    throw new Error('Envio bloqueado: credenciais do WhatsApp não verificadas.');
  }
  const creds = credentials;
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

  const response = await metaFetch(url, {
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

/**
 * Confere credenciais digitadas à mão (API Direta) antes de gravar:
 * 1. o token tem acesso à WABA e o phone_number_id é dela (na Meta);
 * 2. o número não está ligado a outra conta Domu.
 * Devolve o número oficial (display_phone_number) — é ELE que deve ser gravado
 * em tenants.whatsapp_number, nunca o que a pessoa digitou.
 * Sem isso, alguém gravava o phone_number_id de outro cliente e o webhook
 * passava a entregar as mensagens recebidas dele na conta errada.
 */
export async function verifyMetaPhoneOwnership(input: {
  tenantId: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<
  { ok: true; displayPhoneNumber: string } | { ok: false; status: number; error: string }
> {
  let displayPhoneNumber = '';
  try {
    const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(input.wabaId)}/phone_numbers?fields=id,display_phone_number&limit=100`;
    const res = await metaFetch(url, { headers: { Authorization: `Bearer ${input.accessToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: 400,
        error: `A Meta recusou as credenciais: ${data?.error?.message || 'token sem acesso a esta WABA'}. Confira o Access Token e o WABA ID.`,
      };
    }
    const rows: { id?: string; display_phone_number?: string }[] = Array.isArray(data?.data) ? data.data : [];
    const match = rows.find((row) => String(row?.id || '') === input.phoneNumberId);
    if (!match) {
      return {
        ok: false,
        status: 400,
        error: 'Este Phone Number ID não pertence à WABA informada. Confira os dois IDs no painel da Meta.',
      };
    }
    displayPhoneNumber = String(match.display_phone_number || '');
    if (!displayPhoneNumber) {
      return { ok: false, status: 400, error: 'A Meta não informou o número deste Phone Number ID.' };
    }
  } catch {
    return { ok: false, status: 502, error: 'Não foi possível validar as credenciais na Meta agora. Tente de novo.' };
  }

  const { data: otherOwner } = await supabaseAdmin
    .from('tenant_credentials')
    .select('tenant_id')
    .eq('phone_number_id', input.phoneNumberId)
    .neq('tenant_id', input.tenantId)
    .limit(1);
  if (otherOwner && otherOwner.length > 0) {
    return {
      ok: false,
      status: 409,
      error: 'Este número de WhatsApp já está conectado a outra conta da Domu. Fale com o suporte se ele é seu.',
    };
  }

  return { ok: true, displayPhoneNumber };
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

  const response = await metaFetch(url, {
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

/**
 * Converte variáveis nomeadas Domu ({{nome}}) para posição Meta ({{1}}, {{2}}).
 * A Meta Cloud API exige exemplos quando há placeholders.
 */
export function toMetaPositionalBody(bodyText: string): {
  metaBody: string;
  variables: string[];
  examples: string[];
} {
  const variables: string[] = [];
  const examples: string[] = [];
  const exampleByName: Record<string, string> = {
    nome: 'Maria',
    horario: '15:00',
    data: '31/12/2026',
    produto: 'Oferta Especial',
    valor: 'R$ 299,00',
    texto: 'cliente',
    empresa: 'Sua Empresa',
  };

  const metaBody = bodyText.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_full, rawName: string) => {
    const name = String(rawName).trim();
    let idx = variables.indexOf(name);
    if (idx < 0) {
      variables.push(name);
      examples.push(exampleByName[name.toLowerCase()] || 'exemplo');
      idx = variables.length - 1;
    }
    return `{{${idx + 1}}}`;
  });

  return { metaBody, variables, examples };
}

/** Cria um template HSM na WABA do cliente via Graph API. */
export async function createMetaMessageTemplate(options: {
  tenantId: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language?: string;
  bodyText: string;
  headerType?: 'NONE' | 'IMAGE';
}): Promise<{
  success: boolean;
  metaTemplateId?: string;
  status?: string;
  metaBody?: string;
  variables?: string[];
  error?: string;
  warning?: string;
}> {
  let creds: MetaCredentials;
  try {
    creds = await resolveMetaCredentials(options.tenantId);
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message ||
        'Conecte o WhatsApp (credenciais Meta) antes de criar um template.',
    };
  }

  const wabaId = creds.wabaId || (creds.source === 'env' ? process.env.META_WABA_ID : undefined);
  if (!wabaId) {
    return {
      success: false,
      error:
        'WABA ID ausente. Conecte o WhatsApp pelo onboarding/configurações para criar templates na Meta.',
    };
  }

  const { metaBody, variables, examples } = toMetaPositionalBody(options.bodyText);
  const components: any[] = [
    {
      type: 'BODY',
      text: metaBody,
      ...(examples.length > 0
        ? { example: { body_text: [examples] } }
        : {}),
    },
  ];

  // HEADER IMAGE exige media handle (upload resumable). Por enquanto enviamos
  // só o texto à Meta e mantemos a imagem no Domu para preview local.
  let warning: string | undefined;
  if (options.headerType === 'IMAGE') {
    warning =
      'A imagem foi salva no Domu para preview; a Meta recebeu o template só com o texto (upload de mídia em breve).';
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${wabaId}/message_templates`;
  const payload = {
    name: options.name,
    language: options.language || 'pt_BR',
    category: options.category,
    allow_category_change: true,
    components,
  };

  const response = await metaFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    logger.warn('meta.create_template_failed', {
      tenantId: options.tenantId,
      wabaId,
      message: data?.error?.message,
      code: data?.error?.code,
    });
    return {
      success: false,
      error: data?.error?.message || 'A Meta rejeitou a criação do template.',
    };
  }

  return {
    success: true,
    metaTemplateId: String(data.id || ''),
    status: String(data.status || 'PENDING').toUpperCase(),
    metaBody,
    variables,
    warning,
  };
}

/**
 * Consulta todos os templates cadastrados diretamente na WABA da Meta Cloud API.
 */
export async function fetchMetaMessageTemplates(tenantId?: string): Promise<{
  success: boolean;
  templates?: any[];
  error?: string;
}> {
  let creds: MetaCredentials;
  try {
    creds = await resolveMetaCredentials(tenantId);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Conecte o WhatsApp (credenciais Meta) para consultar templates.',
    };
  }

  const wabaId = creds.wabaId || (creds.source === 'env' ? process.env.META_WABA_ID : undefined);
  if (!wabaId) {
    return {
      success: false,
      error: 'WABA ID ausente. Conecte o WhatsApp para consultar templates da Meta.',
    };
  }

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${wabaId}/message_templates?fields=name,status,category,language,components,id&limit=100`;
    const response = await metaFetch(url, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || 'Falha ao consultar templates na Meta.',
      };
    }

    return {
      success: true,
      templates: data.data || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erro de conexão com a Graph API da Meta.',
    };
  }
}

/** Erro da Meta traduzido para algo que o cliente entende e consegue resolver. */
export function formatMetaError(err: unknown): string {
  if (!err) return 'Falha no envio via Meta Cloud API.';
  let raw = '';
  if (typeof err === 'string') raw = err;
  else if (typeof err === 'object' && err !== null && 'message' in err) {
    raw = String((err as { message: unknown }).message);
  } else {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = 'Falha no envio via Meta Cloud API.';
    }
  }

  const lower = raw.toLowerCase();
  if (lower.includes('131058') || lower.includes('public test numbers')) {
    return 'Os modelos de exemplo da Meta (como "hello_world" e "jaspers_market_*") possuem uma trava da Meta e só podem ser enviados pelo número de testes fictício da Meta. Como sua conta conectou um número real (+55...), a Meta exige o envio através de um modelo próprio aprovado da sua empresa. Acesse o menu Templates para cadastrar e aprovar seu modelo.';
  }
  if (lower.includes('132001') || lower.includes('does not exist in the translation')) {
    return 'Template não encontrado ou não aprovado na sua conta da Meta (WABA). Acesse "Templates" para criar e aguardar aprovação oficial da Meta antes de disparar.';
  }
  if (lower.includes('131030') || lower.includes('not in allowed list')) {
    return 'O telefone de destino não está na lista de números de teste autorizados na sua conta de desenvolvedor da Meta.';
  }
  if (lower.includes('131047') || lower.includes('24 hours')) {
    return 'Janela de 24 horas encerrada. Para iniciar uma nova conversa comercial, é necessário usar um template oficial aprovado pela Meta.';
  }
  if (lower.includes('131026') || lower.includes('undeliverable')) {
    return 'Número de telefone inválido ou sem conta do WhatsApp ativa.';
  }
  if (lower.includes('130429') || lower.includes('rate limit')) {
    return 'Limite temporário de requisições atingido na Meta. Aguarde alguns minutos e tente novamente.';
  }
  if (lower.includes('190') || lower.includes('session') || lower.includes('expired') || lower.includes('access token')) {
    return 'As credenciais de acesso da Meta expiraram. Reconecte seu WhatsApp em Configurações.';
  }
  return raw;
}

/**
 * Status de UM template na Meta (aprovação do follow-up). Consulta direto pelo
 * id — a listagem paginada pode não trazer o template recém-criado.
 */
export async function fetchMetaTemplateStatus(
  tenantId: string,
  metaTemplateId: string
): Promise<{ ok: true; status: 'APPROVED' | 'PENDING' | 'REJECTED'; reason: string | null } | { ok: false; error: string }> {
  let creds: MetaCredentials;
  try {
    creds = await resolveMetaCredentials(tenantId);
  } catch (err: any) {
    return { ok: false, error: err?.message || 'WhatsApp não conectado.' };
  }

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(metaTemplateId)}?fields=status,rejected_reason`;
    const response = await metaFetch(url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data?.error?.message || 'Falha ao consultar o template na Meta.' };

    const raw = String(data.status || 'PENDING').toUpperCase();
    const status = raw === 'APPROVED' || raw === 'ACTIVE' ? 'APPROVED' : raw === 'REJECTED' || raw === 'DISABLED' ? 'REJECTED' : 'PENDING';
    const reason = data.rejected_reason && data.rejected_reason !== 'NONE' ? String(data.rejected_reason) : null;
    return { ok: true, status, reason };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro de conexão com a Meta.' };
  }
}
