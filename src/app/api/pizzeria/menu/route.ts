import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { menuItemFromRow, MENU_ITEMS_MAX, validateMenuItemInput } from '@/lib/pizzeria';
import { isPizzeriaSchemaMissing, loadMenu, PIZZERIA_MIGRATION_PENDING } from '@/lib/pizzeriaServer';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function migrationPending() {
  return NextResponse.json({ success: false, error: PIZZERIA_MIGRATION_PENDING }, { status: 503 });
}

/** Cardápio da conta. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const { error } = await supabaseAdmin.from('menu_items').select('id', { head: true, count: 'exact' }).eq('tenant_id', auth.session.tenantId);
    if (error && isPizzeriaSchemaMissing(error)) {
      return NextResponse.json({ success: true, available: false, error: PIZZERIA_MIGRATION_PENDING, items: [] });
    }
    const items = await loadMenu(auth.session.tenantId);
    return NextResponse.json({
      success: true,
      available: true,
      items,
      canEdit: ['ADMIN', 'SUPER_ADMIN', 'BROKER'].includes(auth.session.role),
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.menu.get', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Vários itens de uma vez (sugestões prontas): { items: [...] }.
    const inputs = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [body];
    const parsed = [];
    for (const input of inputs.slice(0, 60)) {
      const r = validateMenuItemInput(input);
      if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
      parsed.push(r.fields);
    }

    const { count, error: countError } = await supabaseAdmin
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (countError) {
      if (isPizzeriaSchemaMissing(countError)) return migrationPending();
      throw countError;
    }
    if ((count ?? 0) + parsed.length > MENU_ITEMS_MAX) {
      return NextResponse.json({ success: false, error: `O cardápio aceita até ${MENU_ITEMS_MAX} itens.` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .insert(parsed.map((fields) => ({ tenant_id: tenantId, ...fields })))
      .select('*');
    if (error) {
      if (isPizzeriaSchemaMissing(error)) return migrationPending();
      throw error;
    }
    return NextResponse.json({ success: true, items: (data || []).map((row) => menuItemFromRow(row as Record<string, unknown>)) });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.menu.post', error);
  }
}

/** Edita: { id, ...campos }. Para só ligar/desligar: { id, active }. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? '');
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Informe o item.' }, { status: 400 });

    let patch: Record<string, unknown>;
    if (Object.keys(body).every((k) => k === 'id' || k === 'active' || k === 'featured')) {
      patch = {};
      if (body.active !== undefined) patch.active = Boolean(body.active);
      if (body.featured !== undefined) patch.featured = Boolean(body.featured);
    } else {
      const parsed = validateMenuItemInput(body);
      if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
      patch = { ...parsed.fields };
    }

    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .select('*')
      .maybeSingle();
    if (error) {
      if (isPizzeriaSchemaMissing(error)) return migrationPending();
      throw error;
    }
    if (!data) return NextResponse.json({ success: false, error: 'Item não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, item: menuItemFromRow(data as Record<string, unknown>) });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.menu.patch', error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Informe o item.' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .select('id');
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ success: false, error: 'Item não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.menu.delete', error);
  }
}
