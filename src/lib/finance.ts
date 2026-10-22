/**
 * Financeiro dos ramos com agenda. Regras puras: faturamento vem da agenda
 * (preço gravado no agendamento), gastos e entradas avulsas são lançados à mão.
 *
 * Atendimento faturado = concluído, ou confirmado cujo horário já terminou
 * (muito dono não marca "concluído" um por um). Falta e cancelado não contam.
 */
import { brtToUtc } from '@/lib/scheduling';

export type FinanceKind = 'EXPENSE' | 'INCOME';

export const EXPENSE_CATEGORIES = [
  'Produtos e insumos',
  'Aluguel',
  'Salários e comissões',
  'Contas (água, luz, internet)',
  'Marketing',
  'Impostos e taxas',
  'Equipamentos e manutenção',
  'Outros',
] as const;

export const INCOME_CATEGORIES = ['Venda de produtos', 'Serviço fora da agenda', 'Outros'] as const;

export const DESCRIPTION_MAX = 160;
const AMOUNT_MAX = 99_999_999;

export type FinanceEntry = {
  id: string;
  kind: FinanceKind;
  description: string;
  category: string;
  amount: number;
  occurred_on: string;
};

export function validateFinanceEntry(
  input: Record<string, unknown>
): { ok: true; entry: Omit<FinanceEntry, 'id'> } | { ok: false; error: string } {
  const kind = input.kind === 'INCOME' ? 'INCOME' : input.kind === 'EXPENSE' ? 'EXPENSE' : null;
  if (!kind) return { ok: false, error: 'Escolha se é gasto ou entrada.' };

  const description = String(input.description ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DESCRIPTION_MAX);
  if (description.length < 2) return { ok: false, error: 'Descreva o lançamento (ex.: Shampoo, Aluguel de outubro).' };

  const categories: readonly string[] = kind === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const category = String(input.category ?? '');
  if (!categories.includes(category)) return { ok: false, error: 'Escolha uma categoria.' };

  const raw = String(input.amount ?? '').replace(/[R$\s]/g, '');
  const amount =
    typeof input.amount === 'number'
      ? input.amount
      : Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d+\.\d{1,2}$/.test(raw) ? raw : raw.replace(/\./g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > AMOUNT_MAX) return { ok: false, error: 'Informe um valor válido.' };

  const occurredOn = String(input.occurred_on ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || Number.isNaN(new Date(`${occurredOn}T12:00:00Z`).getTime())) {
    return { ok: false, error: 'Informe a data.' };
  }

  return { ok: true, entry: { kind, description, category, amount: Math.round(amount * 100) / 100, occurred_on: occurredOn } };
}

/** "2026-10" válido? */
export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Início e fim do mês em Brasília (fim exclusivo), e as datas para os lançamentos. */
export function monthRange(month: string): { start: Date; end: Date; firstDay: string; lastDay: string } {
  const [y, m] = month.split('-').map(Number);
  const firstDay = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDate = new Date(Date.UTC(y, m, 0));
  const lastDay = `${month}-${String(lastDate.getUTCDate()).padStart(2, '0')}`;
  return { start: brtToUtc(firstDay, 0), end: brtToUtc(next, 0), firstDay, lastDay };
}

export type FinanceAppointment = {
  service_name: string;
  price: number | null;
  status: string;
  starts_at: string;
  ends_at: string;
};

export type AppointmentBucket = 'DONE' | 'UPCOMING' | 'LOST';

/** Em que coluna o agendamento entra no financeiro. */
export function bucketOf(a: Pick<FinanceAppointment, 'status' | 'ends_at'>, now: Date): AppointmentBucket {
  if (a.status === 'COMPLETED') return 'DONE';
  if (a.status === 'CONFIRMED') return new Date(a.ends_at) < now ? 'DONE' : 'UPCOMING';
  return 'LOST';
}

export type FinanceSummary = {
  revenue: number;
  otherIncome: number;
  expenses: number;
  profit: number;
  done: number;
  /** Atendimentos feitos sem preço cadastrado (não entram no faturamento). */
  doneWithoutPrice: number;
  averageTicket: number;
  upcomingRevenue: number;
  upcoming: number;
  lost: number;
  lostRevenue: number;
  byService: { service: string; count: number; revenue: number }[];
  expensesByCategory: { category: string; amount: number }[];
};

const round = (n: number) => Math.round(n * 100) / 100;

export function summarizeFinance(appointments: FinanceAppointment[], entries: FinanceEntry[], now: Date): FinanceSummary {
  let revenue = 0;
  let done = 0;
  let doneWithPrice = 0;
  let upcomingRevenue = 0;
  let upcoming = 0;
  let lost = 0;
  let lostRevenue = 0;
  const byService = new Map<string, { count: number; revenue: number }>();

  for (const a of appointments) {
    const price = a.price == null ? null : Number(a.price);
    const bucket = bucketOf(a, now);
    if (bucket === 'DONE') {
      done++;
      if (price != null) {
        revenue += price;
        doneWithPrice++;
      }
      const s = byService.get(a.service_name) || { count: 0, revenue: 0 };
      s.count++;
      s.revenue += price ?? 0;
      byService.set(a.service_name, s);
    } else if (bucket === 'UPCOMING') {
      upcoming++;
      upcomingRevenue += price ?? 0;
    } else {
      lost++;
      lostRevenue += price ?? 0;
    }
  }

  let otherIncome = 0;
  let expenses = 0;
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === 'INCOME') otherIncome += e.amount;
    else {
      expenses += e.amount;
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    }
  }

  return {
    revenue: round(revenue),
    otherIncome: round(otherIncome),
    expenses: round(expenses),
    profit: round(revenue + otherIncome - expenses),
    done,
    doneWithoutPrice: done - doneWithPrice,
    averageTicket: doneWithPrice ? round(revenue / doneWithPrice) : 0,
    upcomingRevenue: round(upcomingRevenue),
    upcoming,
    lost,
    lostRevenue: round(lostRevenue),
    byService: [...byService.entries()]
      .map(([service, v]) => ({ service, count: v.count, revenue: round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count),
    expensesByCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}
