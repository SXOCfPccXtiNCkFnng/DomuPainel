import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlanMonthlyLimit, getPlanPrice, PLAN_DISPATCH_LIMITS, PlanTier } from '@/lib/planLimits';
import { requireAuth, requireAdmin } from '@/lib/requireAuth';
import { syncTenantSubscriptionFromAsaas } from '@/lib/billing';

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
    const userId = auth.session.userId;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    try {
      await syncTenantSubscriptionFromAsaas(tenantId, user?.email);
    } catch (syncErr) {
      console.warn('[Subscription GET] Asaas sync failed:', syncErr);
    }

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

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
        status: sub?.status || 'TRIAL',
        paymentMethod,
        renewalDate: renewalDateFormatted,
        asaasSubscriptionId: sub?.asaas_subscription_id || null,
        pendingPaymentId: sub?.pending_payment_id || null,
      },
    });
  } catch (error: any) {
    console.error('[Subscription API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Troca de plano exige checkout Asaas (não ativa de graça).
 * Use POST /api/billing/checkout com planTier + acceptedTerms.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Para alterar o plano, use o checkout Asaas em /api/billing/checkout (pagamento confirmado).',
      checkoutPath: '/api/billing/checkout',
    },
    { status: 400 }
  );
}

/** DELETE — cancela no Asaas (para cobranças futuras) e no banco. */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const { tenantId, userId } = auth.session;

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, asaas_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma assinatura encontrada.' },
        { status: 404 }
      );
    }

    if (sub.status === 'CANCELED') {
      return NextResponse.json(
        { success: false, error: 'A assinatura já está cancelada.' },
        { status: 400 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    try {
      const {
        asaasCancelSubscription,
        asaasFindCustomerByEmail,
        asaasListCustomerSubscriptions,
        getAsaasApiKey,
      } = await import('@/lib/asaasClient');

      if (getAsaasApiKey()) {
        const idsToCancel = new Set<string>();
        if (sub.asaas_subscription_id) idsToCancel.add(sub.asaas_subscription_id);

        if (user?.email) {
          const customer = await asaasFindCustomerByEmail(user.email);
          if (customer) {
            const asaasSubs = await asaasListCustomerSubscriptions(customer.id);
            asaasSubs
              .filter((s) => s.status !== 'INACTIVE' && s.status !== 'EXPIRED')
              .forEach((s) => idsToCancel.add(s.id));
          }
        }

        for (const id of idsToCancel) {
          try {
            await asaasCancelSubscription(id);
          } catch (err) {
            console.warn('[Subscription DELETE] Asaas cancel failed for', id, err);
          }
        }
      }
    } catch (err) {
      console.warn('[Subscription DELETE] Asaas cancel skipped:', err);
    }

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    return NextResponse.json({
      success: true,
      message:
        'Assinatura cancelada. As cobranças mensais foram encerradas. Você pode assinar de novo quando quiser.',
    });
  } catch (error: any) {
    console.error('[Subscription DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
