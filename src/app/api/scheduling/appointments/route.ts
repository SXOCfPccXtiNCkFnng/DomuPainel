import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { brtDateKey, brtDayRange, isAppointmentStatus, isValidDateKey } from '@/lib/scheduling';
import {
  APPOINTMENT_COLUMNS,
  createAppointment,
  isSchemaPendingError,
  SCHEDULING_MIGRATION_PENDING,
} from '@/lib/schedulingServer';

export const dynamic = 'force-dynamic';

function migrationPending() {
  return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
}

function toAppointment(row: Record<string, unknown>) {
  return { ...row, price: row.price == null ? null : Number(row.price) };
}

/** Agendamentos de um dia (?date=YYYY-MM-DD, horário de Brasília). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const requested = new URL(req.url).searchParams.get('date');
    const date = isValidDateKey(requested) ? requested : brtDateKey(new Date());
    const { start, end } = brtDayRange(date);

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('tenant_id', auth.session.tenantId)
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString())
      .order('starts_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, date, appointments: (data || []).map(toAppointment) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.appointments.get', error);
  }
}

/** Marca pelo painel: { serviceId, startsAt, customerName, customerPhone, vehicle?, notes? }. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await createAppointment(auth.session.tenantId, body, 'PANEL');
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, appointment: toAppointment(result.appointment) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.appointments.post', error);
  }
}

/** Muda o status: { id, status }. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: unknown };
    if (!body.id) return NextResponse.json({ success: false, error: 'Informe o agendamento.' }, { status: 400 });
    if (!isAppointmentStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('tenant_id', auth.session.tenantId)
      .select(APPOINTMENT_COLUMNS)
      .maybeSingle();
    if (error) {
      if (error.code === '23P01') {
        return NextResponse.json(
          { success: false, error: 'Esse horário já está lotado.' },
          { status: 409 }
        );
      }
      throw error;
    }
    if (!data) return NextResponse.json({ success: false, error: 'Agendamento não encontrado.' }, { status: 404 });

    return NextResponse.json({ success: true, appointment: toAppointment(data) });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.scheduling.appointments.patch', error);
  }
}
