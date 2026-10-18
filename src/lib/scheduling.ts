/**
 * Agenda do segmento automotivo (lava rápido / estética automotiva).
 * Regras puras — usadas pela tela, pela API e, depois, pelo robô que agenda
 * pelo WhatsApp. A duração do serviço ocupa a agenda; `capacity` diz quantos
 * carros cabem ao mesmo tempo (mesma regra do gatilho no banco).
 */

export type DayHours = { enabled: boolean; open: string; close: string };

export type SchedulingSettings = {
  /** 7 itens, índice 0 = domingo. */
  weekly_hours: DayHours[];
  slot_step_minutes: number;
  min_notice_minutes: number;
  booking_horizon_days: number;
  /** Carros atendidos ao mesmo tempo (boxes/equipes). */
  capacity: number;
};

export type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  active: boolean;
};

export type AppointmentStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentSource = 'PANEL' | 'WHATSAPP';

export type Appointment = {
  id: string;
  lead_id: string | null;
  service_id: string | null;
  service_name: string;
  price: number | null;
  customer_name: string;
  customer_phone: string;
  vehicle: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
};

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const SLOT_STEP_OPTIONS = [15, 30, 60] as const;
export const MIN_NOTICE_OPTIONS = [0, 30, 60, 120, 240, 1440] as const;
export const BOOKING_HORIZON_OPTIONS = [7, 14, 30, 60, 90] as const;
export const SERVICE_DURATION_OPTIONS = [15, 20, 30, 40, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480] as const;

export const CAPACITY_MAX = 20;

export const SERVICE_NAME_MAX = 120;
export const VEHICLE_MAX = 120;
export const NOTES_MAX = 500;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

/** Status que ocupam a agenda (iguais à trava appointments_no_overlap do banco). */
export const BLOCKING_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'COMPLETED'];

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && value in APPOINTMENT_STATUS_LABELS;
}

export const DEFAULT_WEEKLY_HOURS: DayHours[] = [
  { enabled: false, open: '08:00', close: '12:00' },
  { enabled: true, open: '08:00', close: '18:00' },
  { enabled: true, open: '08:00', close: '18:00' },
  { enabled: true, open: '08:00', close: '18:00' },
  { enabled: true, open: '08:00', close: '18:00' },
  { enabled: true, open: '08:00', close: '18:00' },
  { enabled: true, open: '08:00', close: '13:00' },
];

export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettings = {
  weekly_hours: DEFAULT_WEEKLY_HOURS,
  slot_step_minutes: 30,
  min_notice_minutes: 60,
  booking_horizon_days: 14,
  capacity: 1,
};

/** "08:30" → 510. Aceita "24:00" como fim do dia. */
export function parseTime(value: unknown): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (m > 59 || h > 24 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Horário de Brasília: UTC-3 fixo (o Brasil não tem horário de verão desde 2019).
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Data "YYYY-MM-DD" em Brasília para um instante. */
export function brtDateKey(date: Date): string {
  return new Date(date.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutos desde a meia-noite (Brasília). */
export function brtMinutesOfDay(date: Date): number {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** Instante UTC de "data + minutos do dia" em Brasília. */
export function brtToUtc(dateKey: string, minutes: number): Date {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + BRT_OFFSET_MS + minutes * MINUTE_MS);
}

export function brtWeekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function addDaysToKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Início (inclusivo) e fim (exclusivo) de um dia de Brasília, em UTC. */
export function brtDayRange(dateKey: string): { start: Date; end: Date } {
  const start = brtToUtc(dateKey, 0);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function validateSchedulingSettings(
  input: Record<string, unknown>
): { ok: true; settings: SchedulingSettings } | { ok: false; error: string } {
  const rawHours = input.weekly_hours;
  if (!Array.isArray(rawHours) || rawHours.length !== 7) {
    return { ok: false, error: 'Informe o horário dos 7 dias da semana.' };
  }
  const weekly_hours: DayHours[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = (rawHours[i] || {}) as Record<string, unknown>;
    const enabled = Boolean(day.enabled);
    const open = parseTime(day.open);
    const close = parseTime(day.close);
    if (open == null || close == null) {
      return { ok: false, error: `${WEEKDAY_LABELS[i]}: horário inválido.` };
    }
    if (enabled && open >= close) {
      return { ok: false, error: `${WEEKDAY_LABELS[i]}: a abertura precisa ser antes do fechamento.` };
    }
    weekly_hours.push({ enabled, open: formatMinutes(open), close: formatMinutes(close) });
  }
  if (!weekly_hours.some((d) => d.enabled)) {
    return { ok: false, error: 'Abra pelo menos um dia da semana.' };
  }

  const step = Number(input.slot_step_minutes);
  if (!(SLOT_STEP_OPTIONS as readonly number[]).includes(step)) {
    return { ok: false, error: 'Escolha um intervalo válido entre horários.' };
  }
  const notice = Number(input.min_notice_minutes);
  if (!(MIN_NOTICE_OPTIONS as readonly number[]).includes(notice)) {
    return { ok: false, error: 'Escolha uma antecedência mínima válida.' };
  }
  const horizon = Number(input.booking_horizon_days);
  if (!(BOOKING_HORIZON_OPTIONS as readonly number[]).includes(horizon)) {
    return { ok: false, error: 'Escolha até quantos dias à frente aceitar agendamentos.' };
  }
  const capacity = input.capacity === undefined || input.capacity === null ? 1 : Number(input.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > CAPACITY_MAX) {
    return { ok: false, error: `A capacidade precisa ficar entre 1 e ${CAPACITY_MAX} carros ao mesmo tempo.` };
  }

  return {
    ok: true,
    settings: {
      weekly_hours,
      slot_step_minutes: step,
      min_notice_minutes: notice,
      booking_horizon_days: horizon,
      capacity,
    },
  };
}

export function settingsFromRow(row: Record<string, unknown> | null | undefined): SchedulingSettings {
  if (!row) return DEFAULT_SCHEDULING_SETTINGS;
  const parsed = validateSchedulingSettings(row);
  return parsed.ok ? parsed.settings : DEFAULT_SCHEDULING_SETTINGS;
}

export function validateServiceInput(input: Record<string, unknown>):
  | { ok: true; fields: { name: string; description: string | null; duration_minutes: number; price: number | null } }
  | { ok: false; error: string } {
  const name = String(input.name ?? '').trim();
  if (name.length < 2) return { ok: false, error: 'Dê um nome ao serviço.' };
  if (name.length > SERVICE_NAME_MAX) return { ok: false, error: 'Nome do serviço muito longo.' };

  const duration = Number(input.duration_minutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) {
    return { ok: false, error: 'A duração precisa ficar entre 5 minutos e 12 horas.' };
  }

  let price: number | null = null;
  if (input.price !== undefined && input.price !== null && String(input.price).trim() !== '') {
    price = Number(String(input.price).replace(',', '.'));
    if (!Number.isFinite(price) || price < 0 || price > 99_999_999) {
      return { ok: false, error: 'Preço inválido.' };
    }
    price = Math.round(price * 100) / 100;
  }

  const description = String(input.description ?? '').trim().slice(0, 500) || null;
  return { ok: true, fields: { name, description, duration_minutes: duration, price } };
}

export type BusyRange = { start: Date; end: Date };

/**
 * Maior número de agendamentos simultâneos dentro de [start, end). O pico
 * sempre acontece no início do intervalo ou no início de algum agendamento
 * que começa dentro dele.
 */
export function peakOccupancy(start: Date, end: Date, busy: BusyRange[]): number {
  const points = [start, ...busy.filter((b) => b.start > start && b.start < end).map((b) => b.start)];
  let peak = 0;
  for (const p of points) {
    const count = busy.filter((b) => b.start <= p && b.end > p).length;
    if (count > peak) peak = count;
  }
  return peak;
}

/**
 * Horários livres de um dia para um serviço: dentro do expediente, com a
 * antecedência mínima, dentro do limite de dias e sem passar da capacidade.
 */
export function availableSlots(params: {
  dateKey: string;
  durationMinutes: number;
  settings: SchedulingSettings;
  busy: BusyRange[];
  now?: Date;
}): Date[] {
  const { dateKey, durationMinutes, settings, busy } = params;
  const now = params.now ?? new Date();
  if (!isValidDateKey(dateKey) || durationMinutes <= 0) return [];

  const todayKey = brtDateKey(now);
  if (dateKey < todayKey || dateKey > addDaysToKey(todayKey, settings.booking_horizon_days)) return [];

  const day = settings.weekly_hours[brtWeekday(dateKey)];
  if (!day?.enabled) return [];
  const open = parseTime(day.open);
  const close = parseTime(day.close);
  if (open == null || close == null) return [];

  const earliest = now.getTime() + settings.min_notice_minutes * MINUTE_MS;
  const slots: Date[] = [];
  for (let m = open; m + durationMinutes <= close; m += settings.slot_step_minutes) {
    const start = brtToUtc(dateKey, m);
    if (start.getTime() < earliest) continue;
    const end = new Date(start.getTime() + durationMinutes * MINUTE_MS);
    if (peakOccupancy(start, end, busy) >= settings.capacity) continue;
    slots.push(start);
  }
  return slots;
}
