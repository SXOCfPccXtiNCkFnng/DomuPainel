import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import {
  isValidReminderMinutes,
  isVisitReminderDue,
  reminderLabel,
  renderVisitReminderTemplate,
  visitReminderText,
  whenLabel,
} from '../visitReminderRules';
import { parseMetaMedia, transcribedBody } from '../audioTranscription';

// 28/10/2026 12:00 em Brasília (quarta-feira).
const now = new Date('2026-10-28T15:00:00Z');
const at = (iso: string) => new Date(iso);

describe('lembrete de visita', () => {
  it('sai quando chega a antecedência escolhida e nunca depois da visita', () => {
    const scheduledAt = at('2026-10-28T18:00:00Z'); // 15:00 em Brasília, daqui a 3h
    expect(isVisitReminderDue({ scheduledAt, reminderMinutes: 120, sentAt: null, now })).toBe(false);
    expect(isVisitReminderDue({ scheduledAt, reminderMinutes: 180, sentAt: null, now })).toBe(true);
    expect(isVisitReminderDue({ scheduledAt, reminderMinutes: 180, sentAt: now, now })).toBe(false);
    expect(isVisitReminderDue({ scheduledAt, reminderMinutes: null, sentAt: null, now })).toBe(false);
    expect(isVisitReminderDue({ scheduledAt: at('2026-10-28T14:00:00Z'), reminderMinutes: 60, sentAt: null, now })).toBe(false);
  });

  it('antecedência entre 5 minutos e 7 dias', () => {
    expect(isValidReminderMinutes(30)).toBe(true);
    expect(isValidReminderMinutes(4)).toBe(false);
    expect(isValidReminderMinutes(7 * 24 * 60 + 1)).toBe(false);
    expect(isValidReminderMinutes(30.5)).toBe(false);
  });

  it('rótulos de tempo e de data', () => {
    expect(reminderLabel(30)).toBe('30 min');
    expect(reminderLabel(60)).toBe('1 hora');
    expect(reminderLabel(150)).toBe('2 horas e 30 min');
    expect(reminderLabel(1440)).toBe('1 dia');
    expect(whenLabel(at('2026-10-28T18:00:00Z'), now)).toBe('hoje às 15:00');
    expect(whenLabel(at('2026-10-29T13:30:00Z'), now)).toBe('amanhã às 10:30');
    expect(whenLabel(at('2026-10-31T12:00:00Z'), now)).toBe('sábado, 31/10 às 09:00');
  });

  it('texto e modelo com o imóvel e o horário', () => {
    const p = { name: 'Maria Souza', property: 'AP-202 · Apartamento 2 quartos', scheduledAt: at('2026-10-28T18:00:00Z'), now };
    expect(visitReminderText(p)).toContain('Oi, Maria!');
    expect(visitReminderText(p)).toContain('AP-202 · Apartamento 2 quartos hoje às 15:00');
    expect(renderVisitReminderTemplate(p)).toBe(
      'Olá, Maria! Lembrete da sua visita ao imóvel AP-202 · Apartamento 2 quartos, marcada para hoje às 15:00. Se precisar remarcar, é só responder esta mensagem.'
    );
  });
});

describe('áudio do cliente', () => {
  it('lê o id da mídia guardado pelo webhook', () => {
    expect(parseMetaMedia('meta-media:1234567890|audio/ogg; codecs=opus')).toEqual({ id: '1234567890', mimeType: 'audio/ogg' });
    expect(parseMetaMedia('meta-media:abc|audio/ogg')).toBeNull();
    expect(parseMetaMedia('https://exemplo.com/a.ogg')).toBeNull();
    expect(parseMetaMedia(null)).toBeNull();
  });

  it('a transcrição vira texto marcado na conversa', () => {
    expect(transcribedBody('  quero   lavar o carro amanhã ')).toBe('🎤 Áudio: "quero lavar o carro amanhã"');
  });
});
