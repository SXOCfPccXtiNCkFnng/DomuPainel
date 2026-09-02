import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: Fetch tenant subscription details & usage metrics from Supabase
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    let activeTenantId = tenantId;
    if (!activeTenantId) {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
      activeTenantId = tenant?.id;
    }

    if (!activeTenantId) {
      return NextResponse.json({ success: false, error: 'Tenant não localizado.' }, { status: 400 });
    }

    // 1. Fetch Subscription from Supabase public.subscriptions
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', activeTenantId)
      .single();

    // 2. Count total dispatches this month from public.dispatches
    const { count: dispatchesCount } = await supabaseAdmin
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', activeTenantId);

    // 3. Count additional agents in public.users
    const { count: usersCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', activeTenantId);

    // Values from database (0 default for agents & dispatches)
    const planTier = sub?.plan_tier || 'STARTER';
    const priceBrl = sub?.monthly_price_brl || (planTier === 'STARTER' ? 197 : planTier === 'ENTERPRISE' ? 997 : 497);
    const messageLimit = sub?.monthly_message_limit || (planTier === 'STARTER' ? 1000 : planTier === 'ENTERPRISE' ? 999999 : 5000);
    const dispatchesUsed = dispatchesCount || 0;
    
    // Default 0 agents used for 1:1 support
    const agentsUsed = 0;
    const agentsLimit = planTier === 'STARTER' ? 0 : planTier === 'ENTERPRISE' ? 999 : 10;

    // Calculate renewal date (current_period_end or +30 days)
    const renewalDateObj = sub?.current_period_end ? new Date(sub.current_period_end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const renewalDateFormatted = `${String(renewalDateObj.getDate()).padStart(2, '0')}/${String(renewalDateObj.getMonth() + 1).padStart(2, '0')}`;

    // Plan Name mapping
    let planName = 'Plano Starter';
    if (planTier === 'PRO') planName = 'Plano Pro';
    if (planTier === 'ENTERPRISE') planName = 'Plano Enterprise';

    return NextResponse.json({
      success: true,
      subscription: {
        planTier,
        planName,
        priceBrl,
        messageLimit,
        dispatchesUsed,
        agentsUsed,
        agentsLimit,
        status: sub?.status || 'ACTIVE',
        paymentMethod: sub?.payment_method || 'PIX',
        cardLastDigits: '8821',
        renewalDate: renewalDateFormatted
      }
    });

  } catch (error: any) {
    console.error('[Subscription API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Update plan tier in Supabase (Upgrade/Downgrade)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, planTier } = body; // planTier: 'STARTER' | 'PRO' | 'ENTERPRISE'

    let activeTenantId = tenantId;
    if (!activeTenantId) {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
      activeTenantId = tenant?.id;
    }

    if (!activeTenantId || !planTier) {
      return NextResponse.json({ success: false, error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    let priceBrl = 497;
    let limit = 5000;
    if (planTier === 'STARTER') {
      priceBrl = 197;
      limit = 1000;
    } else if (planTier === 'ENTERPRISE') {
      priceBrl = 997;
      limit = 999999;
    }

    // Upsert subscription row in Supabase
    const { data: updatedSub, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          tenant_id: activeTenantId,
          plan_tier: planTier,
          monthly_price_brl: priceBrl,
          monthly_message_limit: limit,
          status: 'ACTIVE',
          payment_method: 'PIX',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tenant_id' }
      )
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Plano alterado para ${planTier} com sucesso!`,
      subscription: updatedSub
    });

  } catch (error: any) {
    console.error('[Subscription API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
