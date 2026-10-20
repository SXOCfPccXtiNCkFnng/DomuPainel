import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { getPlanPricesFor, loadTenantSegments } from '@/lib/planPricing';

export const dynamic = 'force-dynamic';

/**
 * Preços vigentes dos planos (cadastro, onboarding e assinatura). Cada ramo
 * pode ter preço próprio:
 * - ?segment=&businessSegment= → preço para o ramo escolhido na tela;
 * - sem parâmetros e logado → preço do ramo da conta;
 * - sem nada → preço padrão.
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  let segment = params.get('segment');
  let businessSegment = params.get('businessSegment');

  if (!segment) {
    const auth = await requireAuth(req).catch(() => null);
    if (auth && 'session' in auth) {
      const saved = await loadTenantSegments(auth.session.tenantId);
      segment = saved.segment;
      businessSegment ||= saved.businessSegment;
    }
  }

  const prices = await getPlanPricesFor({ segment, businessSegment });
  return NextResponse.json({ success: true, prices });
}
