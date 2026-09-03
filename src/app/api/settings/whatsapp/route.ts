import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { encryptData } from '@/lib/crypto';
import { requireAuth, requireAdmin } from '@/lib/requireAuth';
import { generateSecureToken } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

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
        verifyToken: creds?.verify_token || '',
        appId: creds?.app_id || '',
        hasToken: Boolean(creds?.waba_id),
        isVerified: creds?.is_verified || false,
        updatedAt: creds?.updated_at || null,
      },
    });
  } catch (error: any) {
    console.error('[Settings GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({
        whatsapp_number: whatsappPhone?.trim() || '',
        coexistence_status: 'CONNECTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (tenantError) throw tenantError;

    // Só atualiza credenciais se enviou IDs
    if (phoneNumberId?.trim() && wabaId?.trim()) {
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        waba_id: wabaId.trim(),
        phone_number_id: phoneNumberId.trim(),
        verify_token: verifyToken?.trim() || generateSecureToken(16),
        app_id: appId?.trim() || null,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://portal.domutech.digital'}/api/whatsapp/webhook`,
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

      const { error: credError } = await supabaseAdmin
        .from('tenant_credentials')
        .upsert(payload, { onConflict: 'tenant_id' });

      if (credError) throw credError;
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações salvas no banco.',
    });
  } catch (error: any) {
    console.error('[Settings POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
