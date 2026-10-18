import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  availableSlots,
  brtDateKey,
  brtToUtc,
  DEFAULT_SCHEDULING_SETTINGS,
  formatDuration,
  parseTime,
  peakOccupancy,
  validateSchedulingSettings,
  validateServiceInput,
} from '../scheduling';

// Horário de Brasília = UTC-3. 2026-10-17 é sábado; 19 é segunda.
const brt = (iso: string) => new Date(`${iso}-03:00`);
const SATURDAY_NOON = brt('2026-10-17T12:00:00');
const MONDAY = '2026-10-19';
const settings = DEFAULT_SCHEDULING_SETTINGS; // seg–sex 08–18, sáb 08–13, dom fechado, a cada 30 min

const times = (slots: Date[]) =>
  slots.map((s) => s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }));

describe('horário de Brasília', () => {
  it('converte data + minutos para UTC', () => {
    expect(brtToUtc(MONDAY, 8 * 60).toISOString()).toBe('2026-10-19T11:00:00.000Z');
  });

  it('23h em Brasília ainda é o mesmo dia', () => {
    expect(brtDateKey(new Date('2026-10-20T02:00:00Z'))).toBe(MONDAY);
  });

  it('soma dias atravessando o mês', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('availableSlots', () => {
  it('oferece horários em que o serviço inteiro cabe no expediente', () => {
    const slots = availableSlots({ dateKey: MONDAY, durationMinutes: 60, settings, busy: [], now: SATURDAY_NOON });
    const t = times(slots);
    expect(t[0]).toBe('08:00');
    expect(t[t.length - 1]).toBe('17:00');
    expect(slots).toHaveLength(19);
  });

  it('não sobrepõe agendamento existente, mas pode encostar nele', () => {
    const busy = [{ start: brt(`${MONDAY}T09:00:00`), end: brt(`${MONDAY}T10:00:00`) }];
    const t = times(availableSlots({ dateKey: MONDAY, durationMinutes: 60, settings, busy, now: SATURDAY_NOON }));
    expect(t).toContain('08:00');
    expect(t).not.toContain('08:30');
    expect(t).not.toContain('09:00');
    expect(t).not.toContain('09:30');
    expect(t).toContain('10:00');
  });

  it('dia fechado não tem horário', () => {
    expect(
      availableSlots({ dateKey: '2026-10-18', durationMinutes: 30, settings, busy: [], now: SATURDAY_NOON })
    ).toEqual([]);
  });

  it('respeita a antecedência mínima', () => {
    const now = brt(`${MONDAY}T09:10:00`);
    const t = times(availableSlots({ dateKey: MONDAY, durationMinutes: 30, settings, busy: [], now }));
    expect(t[0]).toBe('10:30');
  });

  it('não agenda no passado nem além do limite de dias', () => {
    expect(
      availableSlots({ dateKey: '2026-10-16', durationMinutes: 30, settings, busy: [], now: SATURDAY_NOON })
    ).toEqual([]);
    expect(
      availableSlots({ dateKey: '2026-11-02', durationMinutes: 30, settings, busy: [], now: SATURDAY_NOON })
    ).toEqual([]);
  });

  it('com capacidade 2, um horário só lota com dois carros ao mesmo tempo', () => {
    const two = { ...settings, capacity: 2 };
    const one = [{ start: brt(`${MONDAY}T09:00:00`), end: brt(`${MONDAY}T10:00:00`) }];
    expect(times(availableSlots({ dateKey: MONDAY, durationMinutes: 60, settings: two, busy: one, now: SATURDAY_NOON }))).toContain('09:00');

    const both = [...one, { start: brt(`${MONDAY}T09:30:00`), end: brt(`${MONDAY}T10:30:00`) }];
    const t = times(availableSlots({ dateKey: MONDAY, durationMinutes: 60, settings: two, busy: both, now: SATURDAY_NOON }));
    expect(t).toContain('08:00');
    expect(t).not.toContain('09:00');
    expect(t).toContain('10:30');
  });

  it('capacidade olha o pico, não o total de agendamentos no intervalo', () => {
    const two = { ...settings, capacity: 2 };
    // 9–10 e 10–11 nunca acontecem juntos: um serviço de 9 às 11 ainda cabe.
    const busy = [
      { start: brt(`${MONDAY}T09:00:00`), end: brt(`${MONDAY}T10:00:00`) },
      { start: brt(`${MONDAY}T10:00:00`), end: brt(`${MONDAY}T11:00:00`) },
    ];
    expect(peakOccupancy(brt(`${MONDAY}T09:00:00`), brt(`${MONDAY}T11:00:00`), busy)).toBe(1);
    expect(times(availableSlots({ dateKey: MONDAY, durationMinutes: 120, settings: two, busy, now: SATURDAY_NOON }))).toContain('09:00');
  });

  it('serviço maior que o expediente não cabe', () => {
    expect(
      availableSlots({ dateKey: MONDAY, durationMinutes: 11 * 60, settings, busy: [], now: SATURDAY_NOON })
    ).toEqual([]);
  });
});

describe('validateSchedulingSettings', () => {
  it('aceita a configuração padrão', () => {
    expect(validateSchedulingSettings(settings)).toEqual({ ok: true, settings });
  });

  it('recusa abertura depois do fechamento', () => {
    const weekly_hours = settings.weekly_hours.map((d, i) => (i === 1 ? { ...d, open: '18:00', close: '08:00' } : d));
    const result = validateSchedulingSettings({ ...settings, weekly_hours });
    expect(result.ok).toBe(false);
  });

  it('exige pelo menos um dia aberto', () => {
    const weekly_hours = settings.weekly_hours.map((d) => ({ ...d, enabled: false }));
    expect(validateSchedulingSettings({ ...settings, weekly_hours }).ok).toBe(false);
  });

  it('recusa intervalo fora das opções', () => {
    expect(validateSchedulingSettings({ ...settings, slot_step_minutes: 7 }).ok).toBe(false);
  });

  it('capacidade: padrão 1 quando ausente, entre 1 e 20', () => {
    const { capacity: _omit, ...withoutCapacity } = settings;
    const result = validateSchedulingSettings(withoutCapacity);
    expect(result.ok && result.settings.capacity).toBe(1);
    expect(validateSchedulingSettings({ ...settings, capacity: 0 }).ok).toBe(false);
    expect(validateSchedulingSettings({ ...settings, capacity: 21 }).ok).toBe(false);
    expect(validateSchedulingSettings({ ...settings, capacity: 2.5 }).ok).toBe(false);
  });
});

describe('validateServiceInput', () => {
  it('aceita preço com vírgula', () => {
    const result = validateServiceInput({ name: 'Lavagem simples', duration_minutes: 30, price: '49,90' });
    expect(result).toEqual({
      ok: true,
      fields: { name: 'Lavagem simples', description: null, duration_minutes: 30, price: 49.9 },
    });
  });

  it('preço é opcional', () => {
    const result = validateServiceInput({ name: 'Polimento', duration_minutes: 240, price: '' });
    expect(result.ok && result.fields.price).toBeNull();
  });

  it('recusa nome curto e duração inválida', () => {
    expect(validateServiceInput({ name: 'L', duration_minutes: 30 }).ok).toBe(false);
    expect(validateServiceInput({ name: 'Lavagem', duration_minutes: 0 }).ok).toBe(false);
  });
});

describe('formatação', () => {
  it('parseTime aceita 24:00 e recusa formatos inválidos', () => {
    expect(parseTime('08:30')).toBe(510);
    expect(parseTime('24:00')).toBe(1440);
    expect(parseTime('24:30')).toBeNull();
    expect(parseTime('8:00')).toBeNull();
  });

  it('formatDuration', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(120)).toBe('2h');
  });
});
