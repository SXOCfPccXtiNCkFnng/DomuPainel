import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      tenantId, 
      segment, 
      companyName, 
      whatsappPhone, 
      connectionType, 
      selectedPlan, 
      paymentMethod 
    } = body;

    // Prices mapping
    const prices: Record<string, number> = {
      STARTER: 197.00,
      PRO: 497.00,
      ENTERPRISE: 997.00
    };

    const monthlyPrice = prices[selectedPlan] || 497.00;

    // 1. If tenantId is provided, update existing tenant in Supabase
    let targetTenantId = tenantId;

    if (targetTenantId) {
      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update({
          name: companyName || 'Empresa DOMU',
          segment: segment || 'imobiliario',
          whatsapp_number: whatsappPhone || '',
          coexistence_status: connectionType === 'COEXISTENCE' ? 'CONNECTED' : 'CONNECTED',
          status: 'ACTIVE',
          updated_at: new Date().toISOString()
        })
        .eq('id', targetTenantId);

      if (tenantError) {
        console.error('[Onboarding Tenant Update Error]', tenantError);
      }
    } else {
      // Create a fallback tenant if no tenantId was saved in localStorage
      const slug = (companyName || 'empresa').toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

      const { data: newTenant, error: createTenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
          name: companyName || 'Empresa DOMU',
          slug: slug,
          segment: segment || 'imobiliario',
          whatsapp_number: whatsappPhone || '',
          coexistence_status: 'CONNECTED',
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (!createTenantError && newTenant) {
        targetTenantId = newTenant.id;
      }
    }

    // 2. Upsert Subscription details in Supabase
    if (targetTenantId) {
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          tenant_id: targetTenantId,
          plan_tier: selectedPlan || 'PRO',
          monthly_price_brl: monthlyPrice,
          monthly_message_limit: selectedPlan === 'STARTER' ? 2500 : selectedPlan === 'PRO' ? 10000 : 50000,
          status: 'ACTIVE',
          payment_method: paymentMethod || 'PIX',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });

      if (subError) {
        console.error('[Onboarding Subscription Error]', subError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Dados do onboarding salvos no banco de dados Supabase com sucesso!',
      tenantId: targetTenantId,
      segment,
      selectedPlan
    });

  } catch (error: any) {
    console.error('[Onboarding Complete API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar onboarding no banco.' },
      { status: 500 }
    );
  }
}
