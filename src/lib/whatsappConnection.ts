import { supabaseAdmin } from '@/lib/supabaseServer';
import { decryptData } from '@/lib/crypto';
import {
  getPhoneNumberQuality,
  type MetaCredentials,
  type PhoneNumberQuality,
} from '@/lib/metaClient';
import { nationalPhoneDigits, sameWhatsappNumber } from '@/lib/metaSignupPhone';
import { logOpsAlert } from '@/lib/opsAlert';
import { logger } from '@/lib/logger';

export type VerifiedWhatsApp = {
  credentials: MetaCredentials;
  quality: PhoneNumberQuality;
  displayPhoneNumber: string;
};

export type WhatsAppCheck =
  | ({ ok: true } & VerifiedWhatsApp)
  | {
      ok: false;
      error: string;
      /** true = instabilidade (Meta fora do ar/timeout): tentar de novo, não falhar a campanha. */
      transient: boolean;
    };

const NOT_CONNECTED =
  'WhatsApp não conectado nesta conta. Conecte em Configurações → Integração WhatsApp antes de enviar.';

/**
 * ÚNICO ponto que libera envio pelo WhatsApp de um cliente. Nenhuma mensagem
 * sai sem passar aqui. Exige, nesta ordem:
 * 1. credenciais PRÓPRIAS do cliente salvas e verificadas (nunca as globais do env);
 * 2. o número (phone_number_id) não estar ligado a outra conta Domu;
 * 3. a Meta confirmar, com o token DESTE cliente, que o número existe e é acessível;
 * 4. o número que a Meta devolve ser o MESMO cadastrado na conta.
 * Qualquer divergência bloqueia — é melhor não enviar do que enviar pelo número errado.
 */
export async function requireVerifiedWhatsApp(tenantId: string): Promise<WhatsAppCheck> {
  if (!tenantId) return { ok: false, error: NOT_CONNECTED, transient: false };

  const [{ data: cred, error: credError }, { data: tenant, error: tenantError }] = await Promise.all([
    supabaseAdmin
      .from('tenant_credentials')
      .select('phone_number_id, waba_id, encrypted_access_token, token_encryption_iv, is_verified')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabaseAdmin.from('tenants').select('whatsapp_number').eq('id', tenantId).maybeSingle(),
  ]);
  if (credError || tenantError) {
    return { ok: false, error: 'Não foi possível conferir a conexão do WhatsApp agora.', transient: true };
  }

  if (
    !cred?.phone_number_id ||
    !cred.encrypted_access_token ||
    !cred.token_encryption_iv ||
    cred.is_verified !== true
  ) {
    return { ok: false, error: NOT_CONNECTED, transient: false };
  }

  const { data: sharing, error: sharingError } = await supabaseAdmin
    .from('tenant_credentials')
    .select('tenant_id')
    .eq('phone_number_id', cred.phone_number_id)
    .neq('tenant_id', tenantId)
    .limit(1);
  if (sharingError) {
    return { ok: false, error: 'Não foi possível conferir a conexão do WhatsApp agora.', transient: true };
  }
  if (sharing && sharing.length > 0) {
    await logOpsAlert({
      source: 'whatsapp.numero_duplicado',
      message: `phone_number_id ${cred.phone_number_id} ligado a mais de uma conta. Envios bloqueados até resolver.`,
      tenantId,
    });
    return {
      ok: false,
      error:
        'Este número de WhatsApp aparece ligado a mais de uma conta. Por segurança os envios estão bloqueados — fale com o suporte.',
      transient: false,
    };
  }

  let accessToken: string;
  try {
    accessToken = decryptData(cred.encrypted_access_token, cred.token_encryption_iv);
  } catch {
    return {
      ok: false,
      error: 'O token salvo do WhatsApp não pôde ser lido. Reconecte em Configurações → Integração WhatsApp.',
      transient: false,
    };
  }

  const credentials: MetaCredentials = {
    accessToken,
    phoneNumberId: cred.phone_number_id,
    wabaId: cred.waba_id || undefined,
    source: 'tenant',
  };

  let quality: PhoneNumberQuality;
  try {
    quality = await getPhoneNumberQuality(credentials);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const lower = message.toLowerCase();
    // Token inválido/expirado/sem permissão = problema definitivo da conexão.
    const definitive =
      lower.includes('access token') ||
      lower.includes('session') ||
      lower.includes('expired') ||
      lower.includes('permission') ||
      lower.includes('does not exist') ||
      lower.includes('unsupported get request');
    logger.warn('whatsapp.verify_failed', { tenantId, message, definitive });
    return definitive
      ? {
          ok: false,
          error: `A Meta não confirmou o número desta conta (${message || 'credencial inválida'}). Reconecte em Configurações → Integração WhatsApp.`,
          transient: false,
        }
      : {
          ok: false,
          error: 'A Meta não respondeu agora para confirmar o número. O envio será tentado de novo.',
          transient: true,
        };
  }

  const metaNumber = quality.displayPhoneNumber || '';
  const registered = tenant?.whatsapp_number || '';
  if (!metaNumber || !registered || !sameWhatsappNumber(metaNumber, registered)) {
    logger.warn('whatsapp.number_mismatch', {
      tenantId,
      meta: nationalPhoneDigits(metaNumber),
      registered: nationalPhoneDigits(registered),
    });
    return {
      ok: false,
      error: !registered
        ? 'O número do WhatsApp desta conta não está cadastrado. Reconecte em Configurações → Integração WhatsApp.'
        : `O número conectado na Meta (${metaNumber || 'desconhecido'}) é diferente do cadastrado na conta (${registered}). Por segurança nada será enviado — reconecte o WhatsApp em Configurações.`,
      transient: false,
    };
  }

  return { ok: true, credentials, quality, displayPhoneNumber: metaNumber };
}
