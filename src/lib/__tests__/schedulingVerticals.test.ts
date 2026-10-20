import { describe, expect, it } from 'vitest';
import { buildAssistantSystemPrompt, DEFAULT_ASSISTANT_SETTINGS, sampleGreeting } from '../assistantPrompt';
import { assistantToolDeclarations } from '../assistantTools';
import { reminderText } from '../appointmentReminderRules';
import { DEFAULT_SCHEDULING_SETTINGS, type ServiceItem } from '../scheduling';
import { isSchedulingSegment, SCHEDULING_COPY, schedulingVerticalOf } from '../schedulingVerticals';
import { getNavSectionsForSegment } from '../segmentConfig';

const services: ServiceItem[] = [
  { id: '1', name: 'Corte masculino', description: null, duration_minutes: 30, price: 45, active: true },
  { id: '2', name: 'Limpeza de pele', description: 'Precisa de avaliação antes', duration_minutes: 60, price: 150, active: true },
];

const build = (vertical?: 'automotivo' | 'saude') =>
  buildAssistantSystemPrompt({
    settings: { ...DEFAULT_ASSISTANT_SETTINGS, assistant_name: 'Bia' },
    companyName: 'Navalha de Ouro',
    services,
    scheduling: DEFAULT_SCHEDULING_SETTINGS,
    now: new Date('2026-10-22T15:00:00Z'),
    vertical,
  });

describe('ramos com agenda', () => {
  it('reconhece lava rápido e saúde e beleza', () => {
    expect(schedulingVerticalOf('saude')).toBe('saude');
    expect(schedulingVerticalOf('automotivo')).toBe('automotivo');
    expect(schedulingVerticalOf('imobiliario')).toBeNull();
    expect(isSchedulingSegment('geral')).toBe(false);
  });

  it('saúde e beleza não fala de carro e traz as regras de saúde', () => {
    const prompt = build('saude');
    expect(prompt).not.toMatch(/carro|lava rápido/i);
    expect(prompt).toContain('saúde e beleza');
    expect(prompt).toContain('não dê diagnóstico');
    expect(prompt).toContain('SAMU 192');
    expect(prompt).toContain('confirme o resumo (serviço, dia e horário)');
    expect(prompt).toContain('o dia e horário que o cliente prefere e o nome dele');
  });

  it('lava rápido continua pedindo o carro', () => {
    const prompt = build();
    expect(prompt).toContain('um lava rápido e estética automotiva');
    expect(prompt).toContain('o modelo do carro e o nome dele');
    expect(prompt).toContain('confirme o resumo (serviço, dia, horário e carro)');
    expect(prompt).not.toContain('SAMU');
  });

  it('a ferramenta de agendar só exige o carro no lava rápido', () => {
    const agendar = (v: 'automotivo' | 'saude') => assistantToolDeclarations(v).find((d) => d.name === 'agendar')!;
    expect(agendar('automotivo').parameters.required).toContain('veiculo');
    expect(agendar('saude').parameters.required).not.toContain('veiculo');
    expect(Object.keys(agendar('saude').parameters.properties)).not.toContain('veiculo');
  });

  it('lembrete e saudação sem carro em saúde e beleza', () => {
    const p = { name: 'Ana', service: 'Manicure', time: '15:00' };
    expect(reminderText('HOUR', p, SCHEDULING_COPY.saude.reminderEmoji)).not.toContain('🚗');
    expect(reminderText('HOUR', p)).toContain('🚗');
    const greeting = sampleGreeting({ ...DEFAULT_ASSISTANT_SETTINGS, tone: 'DESCONTRAIDO' }, 'Studio Ana', { vertical: 'saude' });
    expect(greeting).not.toMatch(/carro/);
  });

  it('menu de saúde e beleza tem agenda, atendente, serviços e follow-up', () => {
    const ids = getNavSectionsForSegment('saude').flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(expect.arrayContaining(['agenda', 'atendente', 'servicos', 'followup']));
    const autoIds = getNavSectionsForSegment('automotivo').flatMap((s) => s.items.map((i) => i.id));
    expect(autoIds).not.toContain('followup');
  });
});
