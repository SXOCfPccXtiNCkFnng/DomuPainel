import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { encryptData } from '@/lib/crypto';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const {
      connectionType,
      whatsappPhone,
      companyName,
      segment,
      ownerName,
      cityState,
      wabaId,
      phoneNumberId,
      accessToken,
      verifyToken,
      appId,
    } = body;

    if (!connectionType || !['COEXISTENCE', 'DIRECT_API'].includes(connectionType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de conexão inválido.' },
        { status: 400 }
      );
    }

    if (connectionType === 'DIRECT_API') {
      if (!wabaId?.trim() || !phoneNumberId?.trim() || !accessToken?.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Para API Direta, informe WABA ID, Phone Number ID e Access Token.',
          },
          { status: 400 }
        );
      }
    }

    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({
        name: companyName || undefined,
        segment: segment || undefined,
        whatsapp_number: whatsappPhone || '',
        coexistence_status: 'CONNECTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (tenantError) {
      console.error('[Onboarding Connect Tenant Error]', tenantError);
      return NextResponse.json(
        { success: false, error: 'Falha ao atualizar a empresa no banco.' },
        { status: 500 }
      );
    }

    if (ownerName) {
      await supabaseAdmin
        .from('users')
        .update({
          name: ownerName,
          phone: whatsappPhone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('role', 'ADMIN');
    }

    let credentialsSaved = false;

    if (connectionType === 'DIRECT_API') {
      const { encryptedText, iv } = encryptData(accessToken.trim());
      const finalVerifyToken =
        verifyToken?.trim() || `domu_verify_${tenantId.slice(0, 8)}`;

      const { error: credError } = await supabaseAdmin
        .from('tenant_credentials')
        .upsert(
          {
            tenant_id: tenantId,
            waba_id: wabaId.trim(),
            phone_number_id: phoneNumberId.trim(),
            encrypted_access_token: encryptedText,
            token_encryption_iv: iv,
            verify_token: finalVerifyToken,
            app_id: appId?.trim() || null,
            webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.domutech.digital'}/api/whatsapp/webhook`,
            is_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );

      if (credError) {
        console.error('[Onboarding Connect Credentials Error]', credError);
        return NextResponse.json(
          { success: false, error: 'Falha ao salvar credenciais Meta no banco.' },
          { status: 500 }
        );
      }

      credentialsSaved = true;
    }

    return NextResponse.json({
      success: true,
      message:
        connectionType === 'COEXISTENCE'
          ? 'Coexistência registrada no Supabase.'
          : 'Credenciais Meta salvas no Supabase.',
      connectionType,
      credentialsSaved,
      cityState: cityState || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno.';
    console.error('[Onboarding Connect API Error]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
