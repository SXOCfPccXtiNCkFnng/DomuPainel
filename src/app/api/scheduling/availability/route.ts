import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { availableSlots, brtDayRange, isValidDateKey } from '@/lib/scheduling';
import {
  isSchemaPendingError,
  loadBusyRanges,
  loadSchedulingSettings,
  SCHEDULING_MIGRATION_PENDING,
} from '@/lib/schedulingServer';

export const dynamic = 'force-dynamic';

/** Horários livres (?date=YYYY-MM-DD&serviceId=) seguindo as regras da agenda. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const params = new URL(req.url).searchParams;
    const date = params.get('date');
    const serviceId = params.get('serviceId');
    if (!isValidDateKey(date) || !serviceId) {
      return NextResponse.json({ success: false, error: 'Informe a data e o serviço.' }, { status: 400 });
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('duration_minutes, active')
      .eq('id', serviceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service || !service.active) {
      return NextResponse.json({ success: false, error: 'Serviço não encontrado.' }, { status: 404 });
    }

    const { start, end } = brtDayRange(date);
    const [settings, busy] = await Promise.all([
      loadSchedulingSettings(tenantId),
      loadBusyRanges(tenantId, start, end),
    ]);

    const slots = availableSlots({ dateKey: date, durationMinutes: service.duration_minutes, settings, busy });
    return NextResponse.json({ success: true, slots: slots.map((s) => s.toISOString()) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) {
      return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
    }
    return internalErrorResponse('api.scheduling.availability.get', error);
  }
}
