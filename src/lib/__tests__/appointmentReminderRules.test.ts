import { describe, expect, it } from 'vitest';
import {
  dueReminder,
  isInsideServiceWindow,
  reminderTemplateValues,
  reminderText,
  renderReminderTemplate,
} from '@/lib/appointmentReminderRules';
import { fallbackReplyForEffects } from '@/lib/assistantRules';
import { validateSchedulingSettings, DEFAULT_SCHEDULING_SETTINGS } from '@/lib/scheduling';

const MIN = 60 * 1000;
const now = new Date('2026-10-20T15:00:00Z');
const settings = { reminder_hour_enabled: true, reminder_soon_minutes: 15 };
const base = { now, settings, createdAt: new Date(now.getTime() - 24 * 60 * MIN), hourSentAt: null, soonSentAt: null };
const at = (minutes: number) => new Date(now.getTime() + minutes * MIN);

describe('dueReminder', () => {
  it('manda o de 1 hora quando falta até 60 min', () => {
    expect(dueReminder({ ...base, startsAt: at(58) })).toBe('HOUR');
    expect(dueReminder({ ...base, startsAt: at(75) })).toBeNull();
  });

  it('agendou em cima da hora: manda o de 1 hora mesmo assim, depois de alguns minutos', () => {
    expect(dueReminder({ ...base, startsAt: at(40), createdAt: new Date(now.getTime() - 2 * MIN) })).toBeNull();
    expect(dueReminder({ ...base, startsAt: at(40), createdAt: new Date(now.getTime() - 12 * MIN) })).toBe('HOUR');
  });

  it('em cima da hora vence o de 1 hora e não repete', () => {
    expect(dueReminder({ ...base, startsAt: at(14) })).toBe('SOON');
    expect(dueReminder({ ...base, startsAt: at(14), soonSentAt: now })).toBeNull();
    expect(dueReminder({ ...base, startsAt: at(14), createdAt: now })).toBe('SOON');
  });

  it('não manda nada depois do horário nem com tudo desligado', () => {
    expect(dueReminder({ ...base, startsAt: at(-1) })).toBeNull();
    const off = { reminder_hour_enabled: false, reminder_soon_minutes: 0 };
    expect(dueReminder({ ...base, settings: off, startsAt: at(10) })).toBeNull();
    expect(dueReminder({ ...base, settings: off, startsAt: at(50) })).toBeNull();
  });

  it('com o de 30 min, o de 1 hora sai entre 60 e 30', () => {
    const s30 = { reminder_hour_enabled: true, reminder_soon_minutes: 30 };
    expect(dueReminder({ ...base, settings: s30, startsAt: at(45) })).toBe('HOUR');
    expect(dueReminder({ ...base, settings: s30, startsAt: at(29) })).toBe('SOON');
  });
});

describe('janela de 24h', () => {
  it('texto livre só até 24h depois da última mensagem do cliente', () => {
    expect(isInsideServiceWindow(null, now)).toBe(false);
    expect(isInsideServiceWindow(new Date(now.getTime() - 60 * MIN), now)).toBe(true);
    expect(isInsideServiceWindow(new Date(now.getTime() - 24 * 60 * MIN), now)).toBe(false);
  });
});

describe('textos do lembrete', () => {
  const p = { name: 'Maria Souza', service: 'Lavagem completa', time: '15:00' };
  it('usa o primeiro nome e ignora nomes genéricos', () => {
    expect(reminderText('HOUR', p)).toContain('Oi, Maria!');
    expect(reminderText('SOON', { ...p, name: 'Contato WhatsApp' })).toMatch(/^Oi! /);
    expect(reminderTemplateValues({ ...p, name: null })).toEqual(['cliente', 'Lavagem completa', '15:00']);
  });
  it('preenche o modelo', () => {
    expect(renderReminderTemplate(p)).toBe(
      'Olá, Maria! Lembrete do seu horário de Lavagem completa hoje às 15:00. Se precisar remarcar, é só responder esta mensagem.'
    );
  });
});

describe('configuração da agenda', () => {
  it('conta antiga sem campos de lembrete fica com lembretes ligados', () => {
    const { reminder_hour_enabled, reminder_soon_minutes, ...old } = DEFAULT_SCHEDULING_SETTINGS;
    void reminder_hour_enabled;
    void reminder_soon_minutes;
    const parsed = validateSchedulingSettings(old as Record<string, unknown>);
    expect(parsed.ok && parsed.settings.reminder_hour_enabled).toBe(true);
    expect(parsed.ok && parsed.settings.reminder_soon_minutes).toBe(15);
  });
  it('recusa minutos fora das opções', () => {
    expect(validateSchedulingSettings({ ...DEFAULT_SCHEDULING_SETTINGS, reminder_soon_minutes: 20 }).ok).toBe(false);
  });
});

describe('fallbackReplyForEffects', () => {
  it('confirma o agendamento quando a IA não terminou', () => {
    const text = fallbackReplyForEffects({
      booked: [{ servico: 'Polimento', data: '2026-10-22', dia_da_semana: 'quinta-feira', horario: '09:00' }],
      visits: [],
      cancelled: 0,
      handoff: false,
    });
    expect(text).toBe('Agendamento confirmado ✅\nPolimento — quinta-feira, 22/10 às 09:00.');
  });
  it('sem efeito nenhum não inventa resposta', () => {
    expect(fallbackReplyForEffects({ booked: [], visits: [], cancelled: 0, handoff: false })).toBeNull();
  });
});
