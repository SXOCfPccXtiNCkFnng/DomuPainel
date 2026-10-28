/**
 * Lembrete de visita para o cliente (imobiliário). O corretor marca a data e
 * a hora e escolhe com quanto tempo de antecedência o cliente é avisado.
 */
import { brtDateKey } from '@/lib/scheduling';

export const VISIT_REMINDER_TEMPLATE_PREFIX = 'domu_lembrete_visita_';
export const VISIT_REMINDER_MIN_MINUTES = 5;
export const VISIT_REMINDER_MAX_MINUTES = 7 * 24 * 60;

/** Atalhos da tela (o corretor também pode digitar outro tempo). */
export const VISIT_REMINDER_PRESETS = [15, 30, 60, 120, 180, 1440] as const;

/** Modelo aprovado pela Meta (fora da janela de 24h). Variáveis separadas por texto (exigência da Meta). */
export const VISIT_REMINDER_TEMPLATE_BODY =
  'Olá, {{nome}}! Lembrete da sua visita ao imóvel {{imovel}}, marcada para {{quando}}. Se precisar remarcar, é só responder esta mensagem.';

export function isValidReminderMinutes(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= VISIT_REMINDER_MIN_MINUTES &&
    value <= VISIT_REMINDER_MAX_MINUTES
  );
}

/** "15 min", "1 hora", "2 horas", "1 dia", "1 dia e 2 horas". */
export function reminderLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(days === 1 ? '1 dia' : `${days} dias`);
  if (hours) parts.push(hours === 1 ? '1 hora' : `${hours} horas`);
  if (mins) parts.push(`${mins} min`);
  return parts.join(' e ');
}

export function isVisitReminderDue(input: {
  scheduledAt: Date;
  reminderMinutes: number | null;
  sentAt: Date | null;
  now: Date;
}): boolean {
  if (input.reminderMinutes == null || input.sentAt) return false;
  const remindAt = input.scheduledAt.getTime() - input.reminderMinutes * 60 * 1000;
  return input.now.getTime() >= remindAt && input.now < input.scheduledAt;
}

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

/** "hoje às 15:00", "amanhã às 10:30", "sexta, 31/10 às 9:00". */
export function whenLabel(scheduledAt: Date, now: Date): string {
  const time = timeFormatter.format(scheduledAt);
  const day = brtDateKey(scheduledAt);
  const today = brtDateKey(now);
  const tomorrow = brtDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (day === today) return `hoje às ${time}`;
  if (day === tomorrow) return `amanhã às ${time}`;
  const weekday = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).split('-')[0];
  const [, m, d] = day.split('-');
  return `${weekday}, ${d}/${m} às ${time}`;
}

function firstName(name: string | null | undefined): string {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return /^(contato|cliente)$/i.test(first) ? '' : first;
}

export type VisitReminderParams = { name: string | null; property: string; scheduledAt: Date; now: Date };

/** Texto livre (dentro da janela de 24h). */
export function visitReminderText(p: VisitReminderParams): string {
  const hi = firstName(p.name) ? `Oi, ${firstName(p.name)}!` : 'Oi!';
  return `${hi} Passando para lembrar da sua visita ao imóvel ${p.property} ${whenLabel(p.scheduledAt, p.now)} 🏡\nSe precisar remarcar, é só responder aqui.`;
}

/** Valores do modelo, na ordem: {{1}} nome, {{2}} imóvel, {{3}} quando. */
export function visitReminderTemplateValues(p: VisitReminderParams): string[] {
  return [firstName(p.name) || 'cliente', p.property, whenLabel(p.scheduledAt, p.now)];
}

export function renderVisitReminderTemplate(p: VisitReminderParams): string {
  const [nome, imovel, quando] = visitReminderTemplateValues(p);
  return VISIT_REMINDER_TEMPLATE_BODY.replace('{{nome}}', nome).replace('{{imovel}}', imovel).replace('{{quando}}', quando);
}
