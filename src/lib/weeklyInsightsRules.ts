/**
 * Dicas da semana (ramos com agenda). Regras puras: os números saem da agenda,
 * do Financeiro, das mensagens e da atendente; a IA só escreve as dicas a
 * partir deles. Sem a IA, as dicas fixas daqui garantem o resumo.
 */
import { bucketOf } from '@/lib/finance';
import {
  addDaysToKey,
  brtDateKey,
  brtMinutesOfDay,
  brtToUtc,
  brtWeekday,
  parseTime,
  WEEKDAY_LABELS,
  type DayHours,
} from '@/lib/scheduling';

export type InsightAppointment = {
  lead_id: string | null;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  price: number | null;
  status: string;
  starts_at: string;
  ends_at: string;
  source: string;
};

export type InsightEntry = { kind: 'EXPENSE' | 'INCOME'; category: string; amount: number; occurred_on: string };
export type InsightRun = { status: string; booked: boolean; handoff: boolean };

/** Os 7 dias do resumo (até hoje, em Brasília), a semana anterior e as 4 semanas dos padrões. */
export type InsightWindow = {
  weekStart: string;
  weekEnd: string;
  startAt: Date;
  endAt: Date;
  prevStartAt: Date;
  patternStartAt: Date;
  /** Histórico usado para saber quem é cliente antigo e quem sumiu. */
  historyStartAt: Date;
  nextEndAt: Date;
};

export const LAPSED_MIN_DAYS = 30;
export const LAPSED_MAX_DAYS = 90;
const HISTORY_DAYS = 120;
const LAPSED_LEADS_MAX = 300;

export function insightWindow(now: Date): InsightWindow {
  const weekEnd = brtDateKey(now);
  const weekStart = addDaysToKey(weekEnd, -6);
  const tomorrow = addDaysToKey(weekEnd, 1);
  return {
    weekStart,
    weekEnd,
    startAt: brtToUtc(weekStart, 0),
    endAt: brtToUtc(tomorrow, 0),
    prevStartAt: brtToUtc(addDaysToKey(weekStart, -7), 0),
    patternStartAt: brtToUtc(addDaysToKey(weekStart, -21), 0),
    historyStartAt: brtToUtc(addDaysToKey(weekEnd, -HISTORY_DAYS), 0),
    nextEndAt: brtToUtc(addDaysToKey(tomorrow, 7), 0),
  };
}

export type WeeklyMetrics = {
  weekStart: string;
  weekEnd: string;
  revenue: number;
  prevRevenue: number;
  /** Variação do faturamento contra a semana anterior (null sem base para comparar). */
  revenueChangePct: number | null;
  done: number;
  prevDone: number;
  averageTicket: number;
  noShows: number;
  cancelled: number;
  lostRevenue: number;
  upcoming: number;
  upcomingRevenue: number;
  topServices: { service: string; count: number; revenue: number }[];
  /** Últimas 4 semanas, índice 0 = domingo. */
  weekdays: { weekday: number; label: string; count: number; revenue: number; open: boolean }[];
  bestWeekday: string | null;
  weakestWeekday: string | null;
  peakHours: { hour: number; count: number }[];
  bookedByAssistant: number;
  newCustomers: number;
  returningCustomers: number;
  lapsed: { count: number; sample: string[]; leadIds: string[] };
  expenses: number;
  otherIncome: number;
  profit: number;
  topExpense: { category: string; amount: number } | null;
  messages: { inbound: number; prevInbound: number; afterHours: number; busiestHour: number | null };
  assistant: { enabled: boolean; replied: number; booked: number; handoffs: number };
};

const round = (n: number) => Math.round(n * 100) / 100;
const phoneKey = (phone: string) => String(phone || '').replace(/\D/g, '').slice(-8);

/** Dentro do horário de atendimento do dia (minutos de Brasília)? */
export function isWithinHours(at: Date, hours: DayHours[]): boolean {
  const day = hours[brtWeekday(brtDateKey(at))];
  if (!day?.enabled) return false;
  const open = parseTime(day.open);
  const close = parseTime(day.close);
  if (open == null || close == null) return false;
  const minutes = brtMinutesOfDay(at);
  return minutes >= open && minutes < close;
}

export function computeWeeklyMetrics(input: {
  window: InsightWindow;
  now: Date;
  /** Agendamentos do histórico inteiro (historyStartAt até nextEndAt). */
  appointments: InsightAppointment[];
  entries: InsightEntry[];
  inboundAt: { week: Date[]; prevCount: number };
  runs: InsightRun[];
  weeklyHours: DayHours[];
  assistantEnabled: boolean;
}): WeeklyMetrics {
  const { window: w, now } = input;
  const at = (iso: string) => new Date(iso).getTime();
  const inRange = (iso: string, from: Date, to: Date) => at(iso) >= from.getTime() && at(iso) < to.getTime();
  const isDone = (a: InsightAppointment) => bucketOf(a, now) === 'DONE';
  const price = (a: InsightAppointment) => (a.price == null ? 0 : Number(a.price));

  const week = input.appointments.filter((a) => inRange(a.starts_at, w.startAt, w.endAt));
  const prev = input.appointments.filter((a) => inRange(a.starts_at, w.prevStartAt, w.startAt));
  const pattern = input.appointments.filter((a) => inRange(a.starts_at, w.patternStartAt, w.endAt) && isDone(a));
  const next = input.appointments.filter(
    (a) => inRange(a.starts_at, w.endAt, w.nextEndAt) && (a.status === 'CONFIRMED' || a.status === 'COMPLETED')
  );

  const weekDone = week.filter(isDone);
  const prevDone = prev.filter(isDone);
  const revenue = weekDone.reduce((s, a) => s + price(a), 0);
  const prevRevenue = prevDone.reduce((s, a) => s + price(a), 0);
  const priced = weekDone.filter((a) => a.price != null);

  const services = new Map<string, { count: number; revenue: number }>();
  for (const a of weekDone) {
    const s = services.get(a.service_name) || { count: 0, revenue: 0 };
    s.count++;
    s.revenue += price(a);
    services.set(a.service_name, s);
  }

  const weekdays = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    count: 0,
    revenue: 0,
    open: Boolean(input.weeklyHours[weekday]?.enabled),
  }));
  const hours = new Map<number, number>();
  for (const a of pattern) {
    const start = new Date(a.starts_at);
    const d = weekdays[brtWeekday(brtDateKey(start))];
    d.count++;
    d.revenue += price(a);
    const hour = Math.floor(brtMinutesOfDay(start) / 60);
    hours.set(hour, (hours.get(hour) || 0) + 1);
  }
  const openDays = weekdays.filter((d) => d.open);
  const ranked = [...openDays].sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  const hasPattern = pattern.length >= 5;

  // Clientes: novo (primeira vez no histórico) x antigo; quem sumiu (último atendimento há 30–90 dias, nada marcado).
  const lastDoneBefore = new Map<string, number>();
  const lastDone = new Map<string, { at: number; name: string; leadId: string | null }>();
  const hasFuture = new Set<string>();
  for (const a of input.appointments) {
    const key = phoneKey(a.customer_phone);
    if (!key) continue;
    if (at(a.starts_at) >= now.getTime() && (a.status === 'CONFIRMED' || a.status === 'COMPLETED')) hasFuture.add(key);
    if (!isDone(a)) continue;
    if (at(a.starts_at) < w.startAt.getTime()) lastDoneBefore.set(key, Math.max(lastDoneBefore.get(key) || 0, at(a.starts_at)));
    const current = lastDone.get(key);
    if (!current || at(a.starts_at) > current.at) {
      lastDone.set(key, { at: at(a.starts_at), name: a.customer_name, leadId: a.lead_id ?? current?.leadId ?? null });
    }
  }
  const weekCustomers = new Set(weekDone.map((a) => phoneKey(a.customer_phone)).filter(Boolean));
  let returningCustomers = 0;
  for (const key of weekCustomers) if (lastDoneBefore.has(key)) returningCustomers++;

  const dayMs = 24 * 60 * 60 * 1000;
  const lapsed = [...lastDone.entries()]
    .filter(([key, v]) => {
      const days = (now.getTime() - v.at) / dayMs;
      return days >= LAPSED_MIN_DAYS && days <= LAPSED_MAX_DAYS && !hasFuture.has(key);
    })
    .sort((a, b) => b[1].at - a[1].at);

  let expenses = 0;
  let otherIncome = 0;
  const categories = new Map<string, number>();
  for (const e of input.entries) {
    if (e.occurred_on < w.weekStart || e.occurred_on > w.weekEnd) continue;
    if (e.kind === 'INCOME') otherIncome += e.amount;
    else {
      expenses += e.amount;
      categories.set(e.category, (categories.get(e.category) || 0) + e.amount);
    }
  }
  const topCategory = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];

  const messageHours = new Map<number, number>();
  let afterHours = 0;
  for (const m of input.inboundAt.week) {
    if (!isWithinHours(m, input.weeklyHours)) afterHours++;
    const hour = Math.floor(brtMinutesOfDay(m) / 60);
    messageHours.set(hour, (messageHours.get(hour) || 0) + 1);
  }
  const busiest = [...messageHours.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    revenue: round(revenue),
    prevRevenue: round(prevRevenue),
    revenueChangePct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
    done: weekDone.length,
    prevDone: prevDone.length,
    averageTicket: priced.length ? round(priced.reduce((s, a) => s + price(a), 0) / priced.length) : 0,
    noShows: week.filter((a) => a.status === 'NO_SHOW').length,
    cancelled: week.filter((a) => a.status === 'CANCELLED').length,
    lostRevenue: round(week.filter((a) => a.status === 'NO_SHOW' || a.status === 'CANCELLED').reduce((s, a) => s + price(a), 0)),
    upcoming: next.length,
    upcomingRevenue: round(next.reduce((s, a) => s + price(a), 0)),
    topServices: [...services.entries()]
      .map(([service, v]) => ({ service, count: v.count, revenue: round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 5),
    weekdays: weekdays.map((d) => ({ ...d, revenue: round(d.revenue) })),
    bestWeekday: hasPattern && ranked[0] ? ranked[0].label : null,
    weakestWeekday: hasPattern && ranked.length > 1 ? ranked[ranked.length - 1].label : null,
    peakHours: [...hours.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count || a.hour - b.hour)
      .slice(0, 3),
    bookedByAssistant: week.filter((a) => a.source === 'WHATSAPP' && a.status !== 'CANCELLED').length,
    newCustomers: weekCustomers.size - returningCustomers,
    returningCustomers,
    lapsed: {
      count: lapsed.length,
      sample: lapsed.slice(0, 5).map(([, v]) => v.name.split(' ')[0]).filter(Boolean),
      leadIds: lapsed
        .map(([, v]) => v.leadId)
        .filter((id): id is string => Boolean(id))
        .slice(0, LAPSED_LEADS_MAX),
    },
    expenses: round(expenses),
    otherIncome: round(otherIncome),
    profit: round(revenue + otherIncome - expenses),
    topExpense: topCategory ? { category: topCategory[0], amount: round(topCategory[1]) } : null,
    messages: {
      inbound: input.inboundAt.week.length,
      prevInbound: input.inboundAt.prevCount,
      afterHours,
      busiestHour: busiest ? busiest[0] : null,
    },
    assistant: {
      enabled: input.assistantEnabled,
      replied: input.runs.filter((r) => r.status === 'REPLIED').length,
      booked: input.runs.filter((r) => r.booked).length,
      handoffs: input.runs.filter((r) => r.handoff).length,
    },
  };
}

// ───────── Dicas ─────────

export const TIP_ACTIONS = {
  CAMPANHA_SUMIDOS: { label: 'Chamar esses clientes', href: '/disparos?publico=sumidos' },
  CAMPANHA: { label: 'Criar campanha', href: '/disparos' },
  AGENDA: { label: 'Abrir a agenda', href: '/agenda' },
  SERVICOS: { label: 'Serviços e horários', href: '/servicos' },
  ATENDENTE: { label: 'Atendente IA', href: '/atendente' },
  FINANCEIRO: { label: 'Abrir o Financeiro', href: '/financeiro' },
  NENHUMA: null,
} as const;

export type TipAction = keyof typeof TIP_ACTIONS;
export type InsightTip = { title: string; text: string; action: TipAction };

export const TIP_TITLE_MAX = 60;
export const TIP_TEXT_MAX = 300;
export const MAX_TIPS = 3;

export function isTipAction(value: unknown): value is TipAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TIP_ACTIONS, value);
}

/** Dicas que vieram da IA: só as bem formadas, no tamanho certo. */
export function sanitizeTips(raw: unknown): InsightTip[] {
  const list = Array.isArray(raw) ? raw : [];
  const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').replace(/[*#]/g, '').trim().slice(0, max);
  return list
    .map((t) => {
      const item = (t || {}) as Record<string, unknown>;
      const title = clean(item.titulo ?? item.title, TIP_TITLE_MAX);
      const text = clean(item.texto ?? item.text, TIP_TEXT_MAX);
      const action = item.acao ?? item.action;
      return { title, text, action: isTipAction(action) ? action : 'NENHUMA' } as InsightTip;
    })
    .filter((t) => t.title.length >= 3 && t.text.length >= 10)
    .slice(0, MAX_TIPS);
}

export const brl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Dicas fixas: usadas quando a IA não responde (ou para completar as dela). */
export function fallbackTips(m: WeeklyMetrics): InsightTip[] {
  const tips: InsightTip[] = [];
  if (m.lapsed.count >= 3) {
    tips.push({
      title: 'Chame quem sumiu',
      text: `${m.lapsed.count} clientes não voltam há mais de ${LAPSED_MIN_DAYS} dias. Uma mensagem de retorno costuma trazer parte deles de volta.`,
      action: 'CAMPANHA_SUMIDOS',
    });
  }
  const best = m.weekdays.find((d) => d.label === m.bestWeekday);
  const weak = m.weekdays.find((d) => d.label === m.weakestWeekday);
  if (best && weak && best.count > 0 && weak.count <= best.count / 2) {
    tips.push({
      title: `Movimente a ${weak.label.toLowerCase()}`,
      text: `Nas últimas 4 semanas, ${weak.label.toLowerCase()} teve ${weak.count} atendimentos e ${best.label.toLowerCase()} teve ${best.count}. Uma promoção só para o dia mais fraco ajuda a encher a agenda.`,
      action: 'CAMPANHA',
    });
  }
  if (m.noShows >= 2) {
    tips.push({
      title: 'Menos faltas na agenda',
      text: `${m.noShows} clientes faltaram nesta semana${m.lostRevenue ? `, ${brl(m.lostRevenue)} que deixaram de entrar` : ''}. Confira se os lembretes automáticos estão ligados.`,
      action: 'SERVICOS',
    });
  }
  if (!m.assistant.enabled && m.messages.afterHours >= 3) {
    tips.push({
      title: 'Clientes chamando fora do horário',
      text: `${m.messages.afterHours} mensagens chegaram fora do horário de atendimento. Com a atendente IA ligada, elas são respondidas e viram agendamento na hora.`,
      action: 'ATENDENTE',
    });
  }
  if (m.expenses > 0 && m.expenses > m.revenue + m.otherIncome) {
    tips.push({
      title: 'Gastos acima do faturamento',
      text: `Os gastos da semana (${brl(m.expenses)}) passaram o que entrou (${brl(m.revenue + m.otherIncome)})${m.topExpense ? `. O maior foi ${m.topExpense.category.toLowerCase()}` : ''}.`,
      action: 'FINANCEIRO',
    });
  }
  if (m.topServices[0] && m.done >= 3) {
    const top = m.topServices[0];
    tips.push({
      title: `${top.service} puxou a semana`,
      text: `Foi o serviço que mais faturou: ${top.count} atendimentos e ${brl(top.revenue)}. Vale destacar ele na próxima campanha.`,
      action: 'CAMPANHA',
    });
  }
  if (!tips.length) {
    tips.push({
      title: 'Registre os atendimentos',
      text: 'Ainda há poucos atendimentos na agenda para encontrar padrões. Quanto mais a agenda for usada, melhores ficam as dicas.',
      action: 'AGENDA',
    });
  }
  return tips.slice(0, MAX_TIPS);
}

/** Completa as dicas da IA com as fixas (sem repetir a mesma ação). */
export function mergeTips(ai: InsightTip[] | null, fallback: InsightTip[]): InsightTip[] {
  const tips = [...(ai || [])];
  for (const tip of fallback) {
    if (tips.length >= MAX_TIPS) break;
    if (!tips.some((t) => t.action === tip.action && tip.action !== 'NENHUMA')) tips.push(tip);
  }
  return tips.slice(0, MAX_TIPS);
}

/** Frase curta do resumo ("R$ 2.450 em 38 atendimentos, 12% a mais que a semana anterior"). */
export function summaryHeadline(m: WeeklyMetrics): string {
  const base = `${brl(m.revenue)} em ${m.done} ${m.done === 1 ? 'atendimento' : 'atendimentos'}`;
  if (m.revenueChangePct == null || m.revenueChangePct === 0) return base;
  return `${base}, ${Math.abs(m.revenueChangePct)}% a ${m.revenueChangePct > 0 ? 'mais' : 'menos'} que a semana anterior`;
}

/** Números em texto para a IA (sem dado pessoal além do primeiro nome). */
export function metricsForAI(m: WeeklyMetrics): string {
  const lines = [
    `Semana: ${m.weekStart} a ${m.weekEnd}`,
    `Faturamento: ${brl(m.revenue)} (semana anterior: ${brl(m.prevRevenue)})`,
    `Atendimentos feitos: ${m.done} (semana anterior: ${m.prevDone}); ticket médio ${brl(m.averageTicket)}`,
    `Faltas: ${m.noShows}; cancelamentos: ${m.cancelled}; valor perdido: ${brl(m.lostRevenue)}`,
    `Já marcado para os próximos 7 dias: ${m.upcoming} atendimentos (${brl(m.upcomingRevenue)})`,
    `Serviços da semana: ${m.topServices.map((s) => `${s.service} (${s.count}, ${brl(s.revenue)})`).join('; ') || 'nenhum'}`,
    `Atendimentos por dia nas últimas 4 semanas: ${m.weekdays.map((d) => `${d.label} ${d.count}${d.open ? '' : ' (fechado)'}`).join(', ')}`,
    `Horários com mais atendimentos (4 semanas): ${m.peakHours.map((h) => `${h.hour}h (${h.count})`).join(', ') || 'sem dados'}`,
    `Clientes da semana: ${m.newCustomers} novos e ${m.returningCustomers} que já eram clientes`,
    `Clientes que não voltam há ${LAPSED_MIN_DAYS} a ${LAPSED_MAX_DAYS} dias e não têm nada marcado: ${m.lapsed.count}`,
    `Agendamentos feitos pela atendente IA na semana: ${m.bookedByAssistant}`,
    `Atendente IA: ${m.assistant.enabled ? `ligada; ${m.assistant.replied} respostas, ${m.assistant.booked} conversas com agendamento, ${m.assistant.handoffs} passadas para a equipe` : 'desligada'}`,
    `Mensagens recebidas: ${m.messages.inbound} (semana anterior: ${m.messages.prevInbound}); fora do horário de atendimento: ${m.messages.afterHours}${m.messages.busiestHour != null ? `; horário com mais mensagens: ${m.messages.busiestHour}h` : ''}`,
    `Financeiro lançado na semana: gastos ${brl(m.expenses)}${m.topExpense ? ` (maior: ${m.topExpense.category} ${brl(m.topExpense.amount)})` : ''}, outras entradas ${brl(m.otherIncome)}, lucro ${brl(m.profit)}`,
  ];
  return lines.join('\n');
}

/** O resumo sai no domingo à noite (18h às 23h59 de Brasília), fechando a semana de segunda a domingo. */
export function isWeeklyInsightsTime(now: Date): boolean {
  return brtWeekday(brtDateKey(now)) === 0 && brtMinutesOfDay(now) >= 18 * 60;
}
