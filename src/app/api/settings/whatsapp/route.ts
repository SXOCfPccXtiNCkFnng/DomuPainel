import { NextRequest, NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { decryptData, encryptData } from '@/lib/crypto';
import { verifyMetaPhoneOwnership } from '@/lib/metaClient';
import { requireAuth, requireAdmin } from '@/lib/requireAuth';
import { generateSecureToken } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const isAdmin = auth.session.role === 'ADMIN' || auth.session.role === 'SUPER_ADMIN';

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name, whatsapp_number, coexistence_status')
      .eq('id', tenantId)
      .maybeSingle();

    const { data: creds } = await supabaseAdmin
      .from('tenant_credentials')
      .select('waba_id, phone_number_id, verify_token, app_id, is_verified, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      settings: {
        whatsappPhone: tenant?.whatsapp_number || '',
        companyName: tenant?.name || '',
        coexistenceStatus: tenant?.coexistence_status || 'DISCONNECTED',
        wabaId: creds?.waba_id || '',
        phoneNumberId: creds?.phone_number_id || '',
        // Segredo do webhook: só quem pode reconfigurar a integração vê.
        verifyToken: isAdmin ? creds?.verify_token || '' : '',
        appId: creds?.app_id || '',
        hasToken: Boolean(creds?.waba_id),
        isVerified: creds?.is_verified || false,
        updatedAt: creds?.updated_at || null,
      },
    });
  } catch (error: any) {
    console.error('[Settings GET]', error);
    return internalErrorResponse('api.settings.whatsapp', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const {
      whatsappPhone,
      phoneNumberId,
      wabaId,
      accessToken,
      verifyToken,
      appId,
    } = body;

    // Sem IDs da Meta: só dá para guardar o número digitado se a conta ainda
    // não tem WhatsApp conectado. Conectada, o número vem SEMPRE da Meta —
    // trocar à mão faria o cadastro divergir do número que realmente envia.
    if (!phoneNumberId?.trim() || !wabaId?.trim()) {
      const { data: existingCred } = await supabaseAdmin
        .from('tenant_credentials')
        .select('phone_number_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (existingCred?.phone_number_id) {
        return NextResponse.json(
          {
            success: false,
            error:
              'O número desta conta vem da conexão com a Meta. Para usar outro número, reconecte o WhatsApp com o novo número.',
          },
          { status: 400 }
        );
      }
      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update({ whatsapp_number: whatsappPhone?.trim() || '', updated_at: new Date().toISOString() })
        .eq('id', tenantId);
      if (tenantError) throw tenantError;
    }

    if (phoneNumberId?.trim() && wabaId?.trim()) {
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        waba_id: wabaId.trim(),
        phone_number_id: phoneNumberId.trim(),
        verify_token: verifyToken?.trim() || generateSecureToken(16),
        app_id: appId?.trim() || null,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.domutech.digital'}/api/whatsapp/webhook`,
        is_verified: true,
        updated_at: new Date().toISOString(),
      };

      // Só recriptografa token se o usuário enviou um novo (não mascara)
      if (accessToken?.trim() && !accessToken.includes('...')) {
        const { encryptedText, iv } = encryptData(accessToken.trim());
        payload.encrypted_access_token = encryptedText;
        payload.token_encryption_iv = iv;
      } else {
        // Upsert exige token — busca existente
        const { data: existing } = await supabaseAdmin
          .from('tenant_credentials')
          .select('encrypted_access_token, token_encryption_iv')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existing?.encrypted_access_token) {
          payload.encrypted_access_token = existing.encrypted_access_token;
          payload.token_encryption_iv = existing.token_encryption_iv;
        } else if (accessToken?.trim()) {
          const { encryptedText, iv } = encryptData(accessToken.trim());
          payload.encrypted_access_token = encryptedText;
          payload.token_encryption_iv = iv;
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'Informe o Access Token da Meta para salvar as credenciais pela primeira vez.',
            },
            { status: 400 }
          );
        }
      }

      // Token novo digitado ou o já salvo: em ambos os casos confere na Meta que
      // ele enxerga esse número antes de ligar o número a esta conta.
      let plainToken = '';
      try {
        plainToken =
          accessToken?.trim() && !accessToken.includes('...')
            ? accessToken.trim()
            : decryptData(String(payload.encrypted_access_token), String(payload.token_encryption_iv));
      } catch {
        return NextResponse.json(
          { success: false, error: 'Não foi possível ler o token salvo. Informe o Access Token novamente.' },
          { status: 400 }
        );
      }
      const ownership = await verifyMetaPhoneOwnership({
        tenantId,
        accessToken: plainToken,
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
      });
      if (!ownership.ok) {
        return NextResponse.json({ success: false, error: ownership.error }, { status: ownership.status });
      }

      const { error: credError } = await supabaseAdmin
        .from('tenant_credentials')
        .upsert(payload, { onConflict: 'tenant_id' });

      if (credError) throw credError;

      // Número oficial da Meta, conferido acima — nunca o digitado.
      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update({
          whatsapp_number: ownership.displayPhoneNumber,
          coexistence_status: 'CONNECTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
      if (tenantError) throw tenantError;
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações salvas no banco.',
    });
  } catch (error: any) {
    console.error('[Settings POST]', error);
    return internalErrorResponse('api.settings.whatsapp', error);
  }
}

/**
 * Desconecta o WhatsApp da conta (só administrador). Apaga as credenciais
 * só na Domu, de propósito sem chamar a Meta: cancelar a inscrição lá com o
 * token salvo tiraria do ar o app DONO do token, que pode ser outro sistema
 * do cliente usando o mesmo número. Contatos, campanhas e histórico ficam.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const nowIso = new Date().toISOString();

    const { error: credError } = await supabaseAdmin
      .from('tenant_credentials')
      .delete()
      .eq('tenant_id', tenantId);
    if (credError) throw credError;

    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({ whatsapp_number: null, coexistence_status: 'DISCONNECTED', updated_at: nowIso })
      .eq('id', tenantId);
    if (tenantError) throw tenantError;

    // Sem número conectado nada sai: o que estava agendado não fica preso na fila.
    await supabaseAdmin
      .from('follow_ups')
      .update({ status: 'CANCELLED', error_message: 'WhatsApp desconectado.', updated_at: nowIso })
      .eq('tenant_id', tenantId)
      .eq('status', 'PENDING');

    return NextResponse.json({ success: true, message: 'WhatsApp desconectado.' });
  } catch (error: unknown) {
    return internalErrorResponse('api.settings.whatsapp.delete', error);
  }
}
