import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { phoneLookupVariants, toStoredPhone } from '@/lib/phone';
import { isValidBrazilianPhone } from '@/lib/validators';
import {
  availableSlots,
  BLOCKING_STATUSES,
  brtDateKey,
  BusyRange,
  NOTES_MAX,
  SchedulingSettings,
  settingsFromRow,
  VEHICLE_MAX,
  type Appointment,
  type AppointmentSource,
} from '@/lib/scheduling';

export const APPOINTMENT_COLUMNS =
  'id, lead_id, service_id, service_name, price, customer_name, customer_phone, vehicle, notes, starts_at, ends_at, status, source';

export const SCHEDULING_MIGRATION_PENDING =
  'A agenda ainda não foi ativada no banco de dados (migration pendente).';

/** Tabela ou coluna inexistente: alguma migration da agenda ainda não rodou. */
export function isSchemaPendingError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
  return code === '42P01' || code === '42703';
}

export async function loadSchedulingSettings(tenantId: string): Promise<SchedulingSettings> {
  const { data, error } = await supabaseAdmin
    .from('scheduling_settings')
    .select('weekly_hours, slot_step_minutes, min_notice_minutes, booking_horizon_days, capacity')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return settingsFromRow(data as Record<string, unknown> | null);
}

export async function loadBusyRanges(tenantId: string, from: Date, to: Date): Promise<BusyRange[]> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('starts_at, ends_at')
    .eq('tenant_id', tenantId)
    .in('status', BLOCKING_STATUSES)
    .lt('starts_at', to.toISOString())
    .gt('ends_at', from.toISOString());
  if (error) throw error;
  return (data || []).map((row) => ({ start: new Date(row.starts_at), end: new Date(row.ends_at) }));
}

/** Liga o agendamento ao contato (cria se ainda não existir) — o cliente entra na base de campanhas. */
async function findOrCreateLeadId(tenantId: string, name: string, phone: string): Promise<string | null> {
  const lookup = async () => {
    const { data } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('phone', phoneLookupVariants(phone))
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  };

  const existing = await lookup();
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({ tenant_id: tenantId, name, phone: toStoredPhone(phone), source: 'AGENDA' })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return lookup();
    logger.warn('scheduling.lead_link_failed', { tenantId, message: error.message });
    return null;
  }
  return data.id;
}

export type CreateAppointmentInput = {
  serviceId?: unknown;
  startsAt?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  vehicle?: unknown;
  notes?: unknown;
  /** Contato já conhecido (conversa do WhatsApp): dispensa a busca por telefone. */
  leadId?: string;
};

export type CreateAppointmentResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; status: number; error: string };

/**
 * Cria um agendamento. Pelo painel o dono pode encaixar fora do expediente;
 * pelo WhatsApp só entra horário livre dentro das regras da agenda.
 */
export async function createAppointment(
  tenantId: string,
  input: CreateAppointmentInput,
  source: AppointmentSource
): Promise<CreateAppointmentResult> {
  const customerName = String(input.customerName ?? '').trim();
  if (customerName.length < 2) return { ok: false, status: 400, error: 'Informe o nome do cliente.' };

  const rawPhone = String(input.customerPhone ?? '').trim();
  // Pelo WhatsApp o número é o wa_id da Meta (pode vir sem o 9 ou de fora do Brasil).
  const phoneOk =
    source === 'WHATSAPP' ? rawPhone.replace(/\D/g, '').length >= 8 : isValidBrazilianPhone(rawPhone);
  if (!phoneOk) {
    return { ok: false, status: 400, error: 'Informe um WhatsApp válido com DDD.' };
  }

  const startsAt = new Date(String(input.startsAt ?? ''));
  if (Number.isNaN(startsAt.getTime())) return { ok: false, status: 400, error: 'Escolha um horário.' };

  const vehicle = String(input.vehicle ?? '').trim().slice(0, VEHICLE_MAX) || null;
  const notes = String(input.notes ?? '').trim().slice(0, NOTES_MAX) || null;

  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('id, name, duration_minutes, price, active')
    .eq('id', String(input.serviceId ?? ''))
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (serviceError) throw serviceError;
  if (!service || !service.active) return { ok: false, status: 400, error: 'Escolha um serviço ativo.' };

  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

  if (source === 'WHATSAPP') {
    const dateKey = brtDateKey(startsAt);
    const [settings, busy] = await Promise.all([
      loadSchedulingSettings(tenantId),
      loadBusyRanges(tenantId, startsAt, endsAt),
    ]);
    const free = availableSlots({ dateKey, durationMinutes: service.duration_minutes, settings, busy });
    if (!free.some((slot) => slot.getTime() === startsAt.getTime())) {
      return { ok: false, status: 409, error: 'Esse horário não está mais disponível.' };
    }
  }

  const leadId = input.leadId ?? (await findOrCreateLeadId(tenantId, customerName, rawPhone));

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      customer_name: customerName,
      customer_phone: toStoredPhone(rawPhone),
      vehicle,
      notes,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'CONFIRMED',
      source,
    })
    .select(APPOINTMENT_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, status: 409, error: 'Esse horário já está lotado.' };
    }
    throw error;
  }

  logger.info('scheduling.appointment_created', { tenantId, source, serviceId: service.id });
  return { ok: true, appointment: data as Appointment };
}
