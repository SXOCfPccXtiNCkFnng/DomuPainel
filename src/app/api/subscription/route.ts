import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlanMonthlyLimit, getPlanPrice, PLAN_DISPATCH_LIMITS, PlanTier } from '@/lib/planLimits';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

function startOfUtcMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Uso real: soma sent_count das campanhas do mês
    const { data: camps } = await supabaseAdmin
      .from('campaigns')
      .select('sent_count')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfUtcMonthIso());

    const dispatchesUsed = (camps || []).reduce(
      (sum, row: { sent_count?: number | null }) => sum + Number(row.sent_count || 0),
      0
    );

    const { count: usersCount } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const planTier = (sub?.plan_tier || 'STARTER') as PlanTier;
    const priceBrl = Number(sub?.monthly_price_brl) || getPlanPrice(planTier);
    const messageLimit = getPlanMonthlyLimit(planTier);
    const dailyLimit = PLAN_DISPATCH_LIMITS[planTier]?.daily ?? null;

    const agentsUsed = usersCount || 0;
    const agentsLimit =
      planTier === 'STARTER' ? 3 : planTier === 'ENTERPRISE' ? 50 : 10;

    const renewalDateObj = sub?.current_period_end
      ? new Date(sub.current_period_end)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const renewalDateFormatted = `${String(renewalDateObj.getDate()).padStart(2, '0')}/${String(renewalDateObj.getMonth() + 1).padStart(2, '0')}`;

    let planName = 'Plano Starter';
    if (planTier === 'PRO') planName = 'Plano Pro';
    if (planTier === 'ENTERPRISE') planName = 'Plano Enterprise';

    const paymentMethod = sub?.payment_method || 'PIX';

    return NextResponse.json({
      success: true,
      subscription: {
        planTier,
        planName,
        priceBrl,
        messageLimit,
        dailyLimit,
        dispatchesUsed,
        agentsUsed,
        agentsLimit,
        status: sub?.status || 'ACTIVE',
        paymentMethod,
        renewalDate: renewalDateFormatted,
      },
    });
  } catch (error: any) {
    console.error('[Subscription API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const { planTier } = body;

    if (!planTier) {
      return NextResponse.json({ success: false, error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    const priceBrl = getPlanPrice(planTier);
    const limit = getPlanMonthlyLimit(planTier);

    const { data: updatedSub, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          tenant_id: tenantId,
          plan_tier: planTier,
          monthly_price_brl: priceBrl,
          monthly_message_limit: limit,
          status: 'ACTIVE',
          payment_method: 'PIX',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Plano alterado para ${planTier} com sucesso!`,
      subscription: updatedSub,
    });
  } catch (error: any) {
    console.error('[Subscription API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
