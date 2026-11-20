import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { isOpenAt, validatePizzeriaSettings } from '@/lib/pizzeria';
import { isPizzeriaSchemaMissing, loadPizzeriaSettings, PIZZERIA_MIGRATION_PENDING } from '@/lib/pizzeriaServer';

export const dynamic = 'force-dynamic';

/** Entrega, retirada, meio a meio e horário de funcionamento. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const settings = await loadPizzeriaSettings(auth.session.tenantId);
    return NextResponse.json({
      success: true,
      settings,
      openNow: isOpenAt(new Date(), settings.weekly_hours),
      canEdit: auth.session.role === 'ADMIN' || auth.session.role === 'SUPER_ADMIN',
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.settings.get', error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validatePizzeriaSettings(body);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('pizzeria_settings')
      .upsert({ tenant_id: auth.session.tenantId, ...parsed.settings, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    if (error) {
      if (isPizzeriaSchemaMissing(error)) {
        return NextResponse.json({ success: false, error: PIZZERIA_MIGRATION_PENDING }, { status: 503 });
      }
      throw error;
    }
    return NextResponse.json({ success: true, settings: parsed.settings, openNow: isOpenAt(new Date(), parsed.settings.weekly_hours) });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.settings.put', error);
  }
}
