import { NextRequest, NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { isSchemaPendingError } from '@/lib/schedulingServer';
import { propertyFromRow, validatePropertyInput, type PropertyFields } from '@/lib/realEstate';

export const dynamic = 'force-dynamic';

const MIGRATION_PENDING = 'O cadastro completo de imóveis ainda não foi ativado no banco (migration 20261021_real_estate.sql).';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function migrationPending() {
  return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
}

/** Código livre na conta? (o corretor e a IA falam do imóvel por ele) */
async function codeTaken(tenantId: string, code: string, exceptId?: string): Promise<boolean> {
  let query = supabaseAdmin.from('properties').select('id').eq('tenant_id', tenantId).ilike('code', code.replace(/[%_\\]/g, '\\$&')).limit(1);
  if (exceptId) query = query.neq('id', exceptId);
  const { data } = await query;
  return Boolean(data?.length);
}

function toRow(fields: PropertyFields) {
  const { code: _code, ...rest } = fields;
  void _code;
  return rest;
}

/** Catálogo da conta (também usado pelo assistente de campanha). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('tenant_id', auth.session.tenantId)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      properties: (data || []).map((row) => propertyFromRow(row as Record<string, unknown>)),
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.properties.get', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Formato antigo mandava { property: {...} }.
    const input = (body.property && typeof body.property === 'object' ? body.property : body) as Record<string, unknown>;
    const parsed = validatePropertyInput(input);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const code = parsed.fields.code || `IMV-${Date.now().toString(36).toUpperCase()}`;
    if (await codeTaken(tenantId, code)) {
      return NextResponse.json({ success: false, error: `Já existe um imóvel com o código ${code}.` }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('properties')
      .insert({ tenant_id: tenantId, code, ...toRow(parsed.fields) })
      .select('*')
      .single();
    if (error) {
      if (isSchemaPendingError(error) || error.code === 'PGRST204') return migrationPending();
      throw error;
    }

    return NextResponse.json({ success: true, property: propertyFromRow(data as Record<string, unknown>) });
  } catch (error: unknown) {
    return internalErrorResponse('api.properties.post', error);
  }
}

/** Edita o imóvel: { id, ...campos }. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? '');
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Informe o imóvel.' }, { status: 400 });

    const parsed = validatePropertyInput(body);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const patch: Record<string, unknown> = { ...toRow(parsed.fields), updated_at: new Date().toISOString() };
    if (parsed.fields.code) {
      if (await codeTaken(tenantId, parsed.fields.code, id)) {
        return NextResponse.json(
          { success: false, error: `Já existe um imóvel com o código ${parsed.fields.code}.` },
          { status: 409 }
        );
      }
      patch.code = parsed.fields.code;
    }

    const { data, error } = await supabaseAdmin
      .from('properties')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isSchemaPendingError(error) || error.code === 'PGRST204') return migrationPending();
      throw error;
    }
    if (!data) return NextResponse.json({ success: false, error: 'Imóvel não encontrado.' }, { status: 404 });

    return NextResponse.json({ success: true, property: propertyFromRow(data as Record<string, unknown>) });
  } catch (error: unknown) {
    return internalErrorResponse('api.properties.patch', error);
  }
}

/** Apaga o imóvel (?id=). Campanhas e pedidos de visita antigos ficam, sem o vínculo. */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const id = new URL(req.url).searchParams.get('id') || '';
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Informe o imóvel.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('properties')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .select('id');
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ success: false, error: 'Imóvel não encontrado.' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.properties.delete', error);
  }
}
