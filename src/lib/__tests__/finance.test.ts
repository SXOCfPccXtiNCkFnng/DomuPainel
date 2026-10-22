import { describe, expect, it } from 'vitest';
import { bucketOf, isMonthKey, monthRange, summarizeFinance, validateFinanceEntry, type FinanceAppointment } from '../finance';

const now = new Date('2026-10-22T15:00:00Z');
const appt = (patch: Partial<FinanceAppointment>): FinanceAppointment => ({
  service_name: 'Corte',
  price: 45,
  status: 'CONFIRMED',
  starts_at: '2026-10-10T13:00:00Z',
  ends_at: '2026-10-10T13:30:00Z',
  ...patch,
});

describe('o que conta como feito', () => {
  it('concluído ou confirmado que já passou; falta e cancelado não', () => {
    expect(bucketOf(appt({ status: 'COMPLETED' }), now)).toBe('DONE');
    expect(bucketOf(appt({}), now)).toBe('DONE');
    expect(bucketOf(appt({ ends_at: '2026-10-25T13:30:00Z' }), now)).toBe('UPCOMING');
    expect(bucketOf(appt({ status: 'NO_SHOW' }), now)).toBe('LOST');
    expect(bucketOf(appt({ status: 'CANCELLED' }), now)).toBe('LOST');
  });
});

describe('summarizeFinance', () => {
  it('soma faturamento, entradas, gastos e lucro', () => {
    const summary = summarizeFinance(
      [
        appt({}),
        appt({ service_name: 'Barba', price: 35, status: 'COMPLETED' }),
        appt({ price: null }),
        appt({ status: 'NO_SHOW' }),
        appt({ ends_at: '2026-10-30T13:30:00Z', price: 70 }),
      ],
      [
        { id: '1', kind: 'EXPENSE', description: 'Aluguel', category: 'Aluguel', amount: 50, occurred_on: '2026-10-05' },
        { id: '2', kind: 'INCOME', description: 'Pomada', category: 'Venda de produtos', amount: 20, occurred_on: '2026-10-06' },
      ],
      now
    );
    expect(summary.revenue).toBe(80);
    expect(summary.done).toBe(3);
    expect(summary.doneWithoutPrice).toBe(1);
    expect(summary.averageTicket).toBe(40);
    expect(summary.otherIncome).toBe(20);
    expect(summary.expenses).toBe(50);
    expect(summary.profit).toBe(50);
    expect(summary.upcomingRevenue).toBe(70);
    expect(summary.lost).toBe(1);
    expect(summary.lostRevenue).toBe(45);
    expect(summary.byService[0]).toEqual({ service: 'Corte', count: 2, revenue: 45 });
  });
});

describe('lançamentos', () => {
  it('aceita valor com máscara e recusa categoria errada', () => {
    const ok = validateFinanceEntry({ kind: 'EXPENSE', description: 'Shampoo', category: 'Produtos e insumos', amount: '1.250,50', occurred_on: '2026-10-01' });
    expect(ok.ok && ok.entry.amount).toBe(1250.5);
    expect(validateFinanceEntry({ kind: 'EXPENSE', description: 'X', category: 'Venda de produtos', amount: '10', occurred_on: '2026-10-01' }).ok).toBe(false);
    expect(validateFinanceEntry({ kind: 'INCOME', description: 'Pomada', category: 'Venda de produtos', amount: '0', occurred_on: '2026-10-01' }).ok).toBe(false);
  });
});

describe('mês', () => {
  it('começa e termina à meia-noite de Brasília', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    const r = monthRange('2026-12');
    expect(r.start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(r.end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
    expect(r.lastDay).toBe('2026-12-31');
    expect(monthRange('2028-02').lastDay).toBe('2028-02-29');
  });
});
