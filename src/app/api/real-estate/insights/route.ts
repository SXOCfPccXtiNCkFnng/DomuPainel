import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { propertyFromRow } from '@/lib/realEstate';
import { computeRealEstateDemand, type DemandLead } from '@/lib/realEstateDemand';
import { planHasSalesIntelligence } from '@/lib/planLimits';

export const dynamic = 'force-dynamic';

/** Inteligência de demanda (últimos 90 dias): só Pro e Enterprise. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { data: sub } = await supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle();
    if (!planHasSalesIntelligence(sub?.plan_tier)) return NextResponse.json({ success: true, locked: true });

    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [leadsRes, propsRes] = await Promise.all([
      supabaseAdmin
        .from('leads')
        .select('interest_purpose, interest_property_type, region, budget_max, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', since)
        .limit(5000),
      supabaseAdmin.from('properties').select('*').eq('tenant_id', tenantId).limit(1000),
    ]);
    // Sem a migration do módulo as colunas de interesse não existem: sem dados.
    if (leadsRes.error?.code === '42703') return NextResponse.json({ success: true, locked: false, demand: null });
    if (leadsRes.error) throw leadsRes.error;
    if (propsRes.error) throw propsRes.error;

    const demand = computeRealEstateDemand(
      (leadsRes.data || []) as DemandLead[],
      (propsRes.data || []).map((r) => propertyFromRow(r as Record<string, unknown>))
    );
    return NextResponse.json({ success: true, locked: false, demand });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.insights.get', error);
  }
}
