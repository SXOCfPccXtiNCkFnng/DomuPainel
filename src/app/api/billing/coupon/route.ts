import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAuth';
import { computeSubscriptionPrice, findActiveCoupon } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/** Valida cupom e devolve preço final. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const code = String(body.couponCode || '');
    const planTier = String(body.planTier || 'STARTER');
    const paymentMethod = body.paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';

    const found = await findActiveCoupon(code, planTier);
    if (!found.ok) {
      return NextResponse.json({ success: false, error: found.error }, { status: 400 });
    }

    const price = computeSubscriptionPrice({
      planTier,
      paymentMethod,
      coupon: found.coupon,
    });

    return NextResponse.json({
      success: true,
      coupon: {
        code: found.coupon.code,
        percentOff: found.coupon.percent_off,
        amountOffBrl: found.coupon.amount_off_brl,
        description: found.coupon.description,
      },
      price,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao validar cupom.' },
      { status: 500 }
    );
  }
}
