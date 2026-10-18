import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { validateServiceInput } from '@/lib/scheduling';
import { isSchemaPendingError, SCHEDULING_MIGRATION_PENDING } from '@/lib/schedulingServer';

export const dynamic = 'force-dynamic';

const SERVICE_COLUMNS = 'id, name, description, duration_minutes, price, active';

function migrationPending() {
  return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
}

function toService(row: Record<string, unknown>) {
  return { ...row, price: row.price == null ? null : Number(row.price) };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const { data, error } = await supabaseAdmin
      .from('services')
      .select(SERVICE_COLUMNS)
      .eq('tenant_id', auth.session.tenantId)
      .order('active', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, services: (data || []).map(toService) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.services.get', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateServiceInput(body);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('services')
      .insert({ tenant_id: auth.session.tenantId, ...parsed.fields })
      .select(SERVICE_COLUMNS)
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, service: toService(data) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.services.post', error);
  }
}

/** Edita (?id=): campos do serviço e/ou { active }. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Informe o serviço.' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) {
      const parsed = validateServiceInput(body);
      if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
      Object.assign(update, parsed.fields);
    }
    if (typeof body.active === 'boolean') update.active = body.active;

    const { data, error } = await supabaseAdmin
      .from('services')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .select(SERVICE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Serviço não encontrado.' }, { status: 404 });

    return NextResponse.json({ success: true, service: toService(data) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.services.patch', error);
  }
}

/** Exclui (?id=). Agendamentos antigos mantêm o nome e o preço do serviço. */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Informe o serviço.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Serviço não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.services.delete', error);
  }
}
