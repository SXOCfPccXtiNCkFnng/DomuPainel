import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { RISK_INACTIVE_DAYS, buildFunnel, findAtRiskTenants } from '@/lib/platformInsights';
import { loadTenantFacts } from '@/lib/platformInsightsServer';

export const dynamic = 'force-dynamic';

const PERIODS = new Set([30, 90]);

/** Funil de cadastro (?days=30|90, vazio = tudo) e clientes pagantes em risco. Fora da allowlist → 404. */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const days = Number(new URL(req.url).searchParams.get('days'));
    const sinceDays = PERIODS.has(days) ? days : null;
    const facts = await loadTenantFacts();
    const atRisk = findAtRiskTenants(facts);
    return NextResponse.json({
      success: true,
      funnel: buildFunnel(facts, { sinceDays }),
      sinceDays,
      atRisk,
      mrrAtRisk: atRisk.reduce((sum, t) => sum + t.monthlyPrice, 0),
      riskInactiveDays: RISK_INACTIVE_DAYS,
      payingTotal: facts.filter((f) => f.subscriptionStatus === 'ACTIVE' && (f.monthlyPrice ?? 0) > 0).length,
    });
  } catch (error) {
    console.error('[interno insights]', error);
    return NextResponse.json({ success: false, error: 'Não foi possível carregar o funil.' }, { status: 500 });
  }
}
