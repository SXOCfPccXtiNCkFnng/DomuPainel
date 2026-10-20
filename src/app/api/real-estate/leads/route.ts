import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { isSchemaPendingError } from '@/lib/schedulingServer';
import { isLeadStage } from '@/lib/realEstate';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION_PENDING = 'Os leads do módulo imobiliário ainda não foram ativados no banco (migration 20261021_real_estate.sql).';

const LEAD_COLUMNS =
  'id, name, phone, status, source, region, budget_max, interest_purpose, interest_property_type, bedrooms_min, ai_summary, last_contact_at, updated_at, assistant_paused_until, properties:interest_property_id(code, title)';

/** Quem conversou ou já tem interesse registrado (contato importado que nunca falou fica só em Contatos). */
const ENGAGED_FILTER =
  'status.neq.NOVO,ai_summary.not.is.null,interest_purpose.not.is.null,interest_property_type.not.is.null,source.eq.WHATSAPP';

/** Leads do funil. ?stage=NOVO|EM_ATENDIMENTO|...&q=nome ou telefone */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const params = new URL(req.url).searchParams;
    const stage = params.get('stage');
    const q = (params.get('q') || '').replace(/[%,()*.]/g, ' ').trim().slice(0, 60);

    let query = supabaseAdmin
      .from('leads')
      .select(LEAD_COLUMNS)
      .eq('tenant_id', auth.session.tenantId)
      .or(ENGAGED_FILTER)
      .order('updated_at', { ascending: false })
      .limit(300);
    if (isLeadStage(stage)) query = query.eq('status', stage);
    if (q) {
      const digits = q.replace(/\D/g, '');
      query = query.or(digits.length >= 4 ? `name.ilike.%${q}%,phone.ilike.%${digits}%` : `name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isSchemaPendingError(error)) {
        return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
      }
      throw error;
    }

    const leads = (data || []).map((row) => {
      const { properties, ...lead } = row as Record<string, unknown> & {
        properties?: { code?: string; title?: string } | null;
      };
      return {
        ...lead,
        budget_max: lead.budget_max == null ? null : Number(lead.budget_max),
        interest_property: properties ? `${properties.code} · ${properties.title}` : null,
      };
    });
    return NextResponse.json({ success: true, leads });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.leads.get', error);
  }
}

/** Muda a etapa do funil: { id, status }. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: unknown };
    if (!UUID_RE.test(String(body.id || ''))) {
      return NextResponse.json({ success: false, error: 'Informe o lead.' }, { status: 400 });
    }
    if (!isLeadStage(body.status)) {
      return NextResponse.json({ success: false, error: 'Etapa inválida.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('tenant_id', auth.session.tenantId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Lead não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.leads.patch', error);
  }
}
