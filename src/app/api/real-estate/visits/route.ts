import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { isSchemaPendingError } from '@/lib/schedulingServer';
import { isVisitStatus, realEstateModeForPlan } from '@/lib/realEstate';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION_PENDING = 'Os pedidos de visita ainda não foram ativados no banco (migration 20261021_real_estate.sql).';

const VISIT_COLUMNS =
  'id, lead_id, property_id, property_label, customer_name, customer_phone, preferred_time, notes, status, created_at';

function isMissing(error: { code?: string } | null): boolean {
  return Boolean(error && (isSchemaPendingError(error) || error.code === 'PGRST205'));
}

/** Pedidos de visita feitos pela atendente (plano Pro). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const [visitsRes, subRes] = await Promise.all([
      supabaseAdmin
        .from('visit_requests')
        .select(VISIT_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle(),
    ]);
    if (isMissing(visitsRes.error)) {
      return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
    }
    if (visitsRes.error) throw visitsRes.error;

    return NextResponse.json({
      success: true,
      visits: visitsRes.data || [],
      planAllowsVisits: realEstateModeForPlan(subRes.data?.plan_tier) === 'COMPLETO',
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.visits.get', error);
  }
}

/** Muda o status: { id, status }. Confirmada → o lead vai para "Visita marcada". */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: unknown };
    if (!UUID_RE.test(String(body.id || ''))) {
      return NextResponse.json({ success: false, error: 'Informe o pedido de visita.' }, { status: 400 });
    }
    if (!isVisitStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('visit_requests')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('tenant_id', tenantId)
      .select(VISIT_COLUMNS)
      .maybeSingle();
    if (isMissing(error)) return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });

    if (body.status === 'CONFIRMED' && data.lead_id) {
      await supabaseAdmin
        .from('leads')
        .update({ status: 'VISITA_AGENDADA', updated_at: new Date().toISOString() })
        .eq('id', data.lead_id)
        .eq('tenant_id', tenantId)
        .in('status', ['NOVO', 'EM_ATENDIMENTO']);
    }
    return NextResponse.json({ success: true, visit: data });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.visits.patch', error);
  }
}
