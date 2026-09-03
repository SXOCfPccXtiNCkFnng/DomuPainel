import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { encryptData } from '@/lib/crypto';
import { generateSecureToken } from '@/lib/email';
import { requireAdmin } from '@/lib/requireAuth';

/**
 * Salva dados de onboarding (empresa / credenciais Meta).
 * NÃO ativa assinatura — ativação só via /api/billing/checkout + pagamento Asaas.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const {
      segment,
      companyName,
      whatsappPhone,
      connectionType,
      ownerName,
      cityState,
      wabaId,
      phoneNumberId,
      accessToken,
      verifyToken,
      appId,
      acceptedTerms,
    } = body;

    if (!acceptedTerms) {
      return NextResponse.json(
        { success: false, error: 'É necessário aceitar os Termos de Uso para continuar.' },
        { status: 400 }
      );
    }

    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({
        name: companyName || 'Empresa DOMU',
        segment: segment || 'imobiliario',
        whatsapp_number: whatsappPhone || '',
        coexistence_status: connectionType ? 'CONNECTED' : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (tenantError) {
      console.error('[Onboarding Tenant Update Error]', tenantError);
      return NextResponse.json(
        { success: false, error: 'Não foi possível atualizar a empresa.' },
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

    if (
      connectionType === 'DIRECT_API' &&
      wabaId &&
      phoneNumberId &&
      accessToken
    ) {
      const { encryptedText, iv } = encryptData(accessToken);
      const { error: credError } = await supabaseAdmin
        .from('tenant_credentials')
        .upsert(
          {
            tenant_id: tenantId,
            waba_id: wabaId,
            phone_number_id: phoneNumberId,
            encrypted_access_token: encryptedText,
            token_encryption_iv: iv,
            verify_token: verifyToken || generateSecureToken(16),
            app_id: appId || null,
            webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.domutech.digital'}/api/whatsapp/webhook`,
            is_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );

      if (credError) {
        console.error('[Onboarding Credentials Error]', credError);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        'Dados salvos. Para liberar o plano, conclua o pagamento em Assinatura / checkout Asaas.',
      tenantId,
      segment,
      cityState: cityState || null,
      connectionType,
      isOnboarded: false,
      requiresPayment: true,
    });
  } catch (error: any) {
    console.error('[Onboarding Complete API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar onboarding.' },
      { status: 500 }
    );
  }
}
