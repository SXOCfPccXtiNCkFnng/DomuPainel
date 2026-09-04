export type PeriodKey = 'today' | '7d' | '30d' | '90d';

export function periodDays(period: PeriodKey): number {
  if (period === 'today') return 1;
  if (period === '7d') return 7;
  if (period === '90d') return 90;
  return 30;
}

/** Início do período (00:00 local), N dias atrás incluindo hoje. */
export function periodStartDate(period: PeriodKey, from: Date = new Date()): Date {
  const days = periodDays(period);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  if (period !== 'today') start.setDate(start.getDate() - (days - 1));
  return start;
}
