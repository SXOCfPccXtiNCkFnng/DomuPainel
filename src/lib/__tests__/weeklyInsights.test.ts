import { describe, expect, it } from 'vitest';
import {
  computeWeeklyMetrics,
  fallbackTips,
  insightWindow,
  isWeeklyInsightsTime,
  mergeTips,
  sanitizeTips,
  summaryHeadline,
  type InsightAppointment,
} from '../weeklyInsightsRules';
import { DEFAULT_WEEKLY_HOURS } from '../scheduling';

// Domingo, 22/11/2026, 20h em Brasília.
const now = new Date('2026-11-22T23:00:00Z');
const w = insightWindow(now);

function appt(dateKey: string, hour: number, extra: Partial<InsightAppointment> = {}): InsightAppointment {
  const start = new Date(`${dateKey}T${String(hour + 3).padStart(2, '0')}:00:00Z`);
  return {
    lead_id: null,
    customer_name: 'Cliente Teste',
    customer_phone: '5511990000000',
    service_name: 'Lavagem completa',
    price: 100,
    status: 'COMPLETED',
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    source: 'PANEL',
    ...extra,
  };
}

function metricsFor(appointments: InsightAppointment[], opts: { assistantEnabled?: boolean; inbound?: Date[] } = {}) {
  return computeWeeklyMetrics({
    window: w,
    now,
    appointments,
    entries: [],
    inboundAt: { week: opts.inbound || [], prevCount: 0 },
    runs: [],
    weeklyHours: DEFAULT_WEEKLY_HOURS,
    assistantEnabled: opts.assistantEnabled ?? true,
  });
}

describe('semana do resumo', () => {
  it('são os 7 dias até hoje (Brasília)', () => {
    expect(w.weekStart).toBe('2026-11-16');
    expect(w.weekEnd).toBe('2026-11-22');
  });

  it('o cron só gera no domingo à noite', () => {
    expect(isWeeklyInsightsTime(now)).toBe(true);
    expect(isWeeklyInsightsTime(new Date('2026-11-22T15:00:00Z'))).toBe(false); // domingo, 12h
    expect(isWeeklyInsightsTime(new Date('2026-11-23T23:00:00Z'))).toBe(false); // segunda
  });
});

describe('números da semana', () => {
  it('faturamento, comparação, faltas e serviços', () => {
    const m = metricsFor([
      appt('2026-11-17', 10),
      appt('2026-11-18', 14, { service_name: 'Polimento', price: 300, customer_phone: '5511980000001' }),
      appt('2026-11-19', 9, { status: 'NO_SHOW', customer_phone: '5511980000002' }),
      appt('2026-11-10', 10, { customer_phone: '5511980000003' }), // semana anterior
    ]);
    expect(m.revenue).toBe(400);
    expect(m.prevRevenue).toBe(100);
    expect(m.revenueChangePct).toBe(300);
    expect(m.done).toBe(2);
    expect(m.noShows).toBe(1);
    expect(m.lostRevenue).toBe(100);
    expect(m.topServices[0]).toEqual({ service: 'Polimento', count: 1, revenue: 300 });
    expect(m.averageTicket).toBe(200);
  });

  it('cliente que não volta há mais de 30 dias e não tem nada marcado entra na lista', () => {
    const m = metricsFor([
      appt('2026-10-01', 10, { customer_name: 'Maria Silva', customer_phone: '5511970000001', lead_id: 'lead-maria' }),
      // João sumiu, mas já marcou de novo: não entra.
      appt('2026-10-05', 10, { customer_name: 'João', customer_phone: '5511970000002', lead_id: 'lead-joao' }),
      appt('2026-11-25', 10, { customer_name: 'João', customer_phone: '5511970000002', status: 'CONFIRMED' }),
      // Ana veio esta semana: não entra.
      appt('2026-11-18', 10, { customer_name: 'Ana', customer_phone: '5511970000003', lead_id: 'lead-ana' }),
    ]);
    expect(m.lapsed.count).toBe(1);
    expect(m.lapsed.sample).toEqual(['Maria']);
    expect(m.lapsed.leadIds).toEqual(['lead-maria']);
    expect(m.upcoming).toBe(1);
  });

  it('cliente que já tinha vindo conta como antigo; o resto é novo', () => {
    const m = metricsFor([
      appt('2026-10-20', 10, { customer_phone: '5511960000001' }),
      appt('2026-11-17', 10, { customer_phone: '5511960000001' }),
      appt('2026-11-18', 10, { customer_phone: '5511960000002' }),
    ]);
    expect(m.returningCustomers).toBe(1);
    expect(m.newCustomers).toBe(1);
  });

  it('mensagens fora do horário de atendimento', () => {
    const m = metricsFor([], {
      inbound: [new Date('2026-11-18T02:00:00Z'), new Date('2026-11-18T14:00:00Z')], // 23h e 11h em Brasília
    });
    expect(m.messages.inbound).toBe(2);
    expect(m.messages.afterHours).toBe(1);
  });
});

describe('dicas', () => {
  it('sem IA, as dicas fixas usam os números de verdade', () => {
    const many = Array.from({ length: 4 }, (_, i) =>
      appt('2026-09-' + String(10 + i), 10, { customer_name: `C${i}`, customer_phone: `551195000000${i}`, lead_id: `l${i}` })
    );
    const m = metricsFor([...many, appt('2026-11-19', 9, { status: 'NO_SHOW' }), appt('2026-11-20', 9, { status: 'NO_SHOW' })], {
      assistantEnabled: false,
    });
    const tips = fallbackTips(m);
    expect(tips[0].action).toBe('CAMPANHA_SUMIDOS');
    expect(tips[0].text).toContain('4 clientes');
    expect(tips.some((t) => t.action === 'SERVICOS')).toBe(true);
    expect(tips.length).toBeLessThanOrEqual(3);
  });

  it('conta sem movimento recebe orientação, não padrão inventado', () => {
    const tips = fallbackTips(metricsFor([]));
    expect(tips).toHaveLength(1);
    expect(tips[0].action).toBe('AGENDA');
  });

  it('dica da IA mal formada é descartada; ação desconhecida vira NENHUMA', () => {
    const tips = sanitizeTips([
      { titulo: 'Promoção na terça', texto: 'Terça teve 3 atendimentos contra 12 no sábado.', acao: 'CAMPANHA' },
      { titulo: '**Oi**', texto: 'curto' },
      { titulo: 'Ação estranha', texto: 'Um texto com tamanho suficiente.', acao: 'APAGAR_TUDO' },
    ]);
    expect(tips).toHaveLength(2);
    expect(tips[1].action).toBe('NENHUMA');
  });

  it('completa as dicas da IA com as fixas sem repetir a ação', () => {
    const merged = mergeTips(
      [{ title: 'A', text: 'texto da IA longo o bastante', action: 'CAMPANHA' }],
      [
        { title: 'B', text: 'outra campanha', action: 'CAMPANHA' },
        { title: 'C', text: 'agenda', action: 'AGENDA' },
      ]
    );
    expect(merged.map((t) => t.title)).toEqual(['A', 'C']);
  });

  it('frase do resumo', () => {
    const m = metricsFor([appt('2026-11-17', 10), appt('2026-11-10', 10, { price: 50 })]);
    expect(summaryHeadline(m)).toBe('R$ 100 em 1 atendimento, 100% a mais que a semana anterior');
  });
});
