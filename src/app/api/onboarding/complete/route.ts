import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { encryptData } from '@/lib/crypto';
import { getPlanMonthlyLimit, getPlanPrice } from '@/lib/planLimits';
import { requireAuth } from '@/lib/requireAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const {
      segment,
      companyName,
      whatsappPhone,
      connectionType,
      selectedPlan,
      paymentMethod,
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
        { success: false, error: 'É necessário aceitar os Termos de Uso para ativar o plano.' },
        { status: 400 }
      );
    }

    const prices: Record<string, number> = {
      STARTER: getPlanPrice('STARTER'),
      PRO: getPlanPrice('PRO'),
      ENTERPRISE: getPlanPrice('ENTERPRISE'),
    };

    const monthlyPrice = prices[selectedPlan] || getPlanPrice('PRO');

    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update({
        name: companyName || 'Empresa DOMU',
        segment: segment || 'imobiliario',
        whatsapp_number: whatsappPhone || '',
        coexistence_status: 'CONNECTED',
        status: 'ACTIVE',
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
            verify_token: verifyToken || `domu_verify_${String(tenantId).slice(0, 8)}`,
            app_id: appId || null,
            webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://portal.domutech.digital'}/api/webhooks/meta`,
            is_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );

      if (credError) {
        console.error('[Onboarding Credentials Error]', credError);
      }
    }

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          tenant_id: tenantId,
          plan_tier: selectedPlan || 'PRO',
          monthly_price_brl: monthlyPrice,
          monthly_message_limit: getPlanMonthlyLimit(selectedPlan),
          status: 'ACTIVE',
          payment_method: paymentMethod || 'PIX',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

    if (subError) {
      console.error('[Onboarding Subscription Error]', subError);
      return NextResponse.json(
        { success: false, error: 'Falha ao ativar a assinatura. Tente novamente.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Dados do onboarding salvos no banco de dados Supabase com sucesso!',
      tenantId,
      segment,
      selectedPlan,
      cityState: cityState || null,
      connectionType,
      isOnboarded: true,
    });
  } catch (error: any) {
    console.error('[Onboarding Complete API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar onboarding no banco.' },
      { status: 500 }
    );
  }
}
