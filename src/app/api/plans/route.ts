import { NextResponse } from 'next/server';
import { getLivePlanPrices } from '@/lib/planPricing';

export const dynamic = 'force-dynamic';

/** Preços vigentes dos planos (público — usado nas telas de cadastro/onboarding/assinatura). */
export async function GET() {
  const prices = await getLivePlanPrices();
  return NextResponse.json({ success: true, prices });
}
