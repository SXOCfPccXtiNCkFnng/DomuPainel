/**
 * Lembretes do agendamento para o cliente final (regras puras, sem rede).
 * - HOUR: 1 hora antes. Agendou em cima da hora? Manda mesmo assim, desde que
 *   ainda falte mais que o lembrete "em cima da hora".
 * - SOON: 15 ou 30 min antes. Se o HOUR ainda não saiu, ele é dispensado.
 * O cron roda a cada 5 min, então cada lembrete sai até ~5 min depois do ponto.
 */

export type ReminderKind = 'HOUR' | 'SOON';

export const REMINDER_HOUR_MINUTES = 60;
export const REMINDER_SOON_OPTIONS = [0, 15, 30] as const;
/** Quem acabou de agendar já recebeu a confirmação: espera um pouco antes do lembrete de 1h. */
export const REMINDER_FRESH_BOOKING_MS = 10 * 60 * 1000;
export const REMINDER_TEMPLATE_PREFIX = 'domu_lembrete_';

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Margem para a janela não fechar entre a conferência e o envio. */
const WINDOW_SAFETY_MS = 5 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type ReminderSettings = { reminder_hour_enabled: boolean; reminder_soon_minutes: number };

export function dueReminder(input: {
  startsAt: Date;
  createdAt: Date | null;
  now: Date;
  settings: ReminderSettings;
  hourSentAt: Date | null;
  soonSentAt: Date | null;
}): ReminderKind | null {
  const { startsAt, now, settings } = input;
  const minutesLeft = (startsAt.getTime() - now.getTime()) / MINUTE_MS;
  if (minutesLeft <= 0) return null;

  const soon = settings.reminder_soon_minutes;
  if (soon > 0 && minutesLeft <= soon) return input.soonSentAt ? null : 'SOON';

  if (!settings.reminder_hour_enabled || input.hourSentAt || minutesLeft > REMINDER_HOUR_MINUTES) return null;
  if (input.createdAt && now.getTime() - input.createdAt.getTime() < REMINDER_FRESH_BOOKING_MS) return null;
  return 'HOUR';
}

/** Texto livre só vale até 24h depois da última mensagem DO CLIENTE. */
export function isInsideServiceWindow(lastInboundAt: Date | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() < lastInboundAt.getTime() + WINDOW_MS - WINDOW_SAFETY_MS;
}

function firstName(name: string | null | undefined): string {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return /^(contato|cliente)$/i.test(first) ? '' : first;
}

export type ReminderParams = { name: string | null; service: string; time: string };

/** Texto livre (dentro da janela de 24h). */
export function reminderText(kind: ReminderKind, p: ReminderParams): string {
  const hi = firstName(p.name) ? `Oi, ${firstName(p.name)}!` : 'Oi!';
  if (kind === 'HOUR') {
    return `${hi} Passando para lembrar do seu horário de ${p.service} hoje às ${p.time} 🚗\nSe precisar remarcar, é só responder aqui.`;
  }
  return `${hi} Seu horário de ${p.service} é daqui a pouco, às ${p.time}. Estamos te esperando! 🚗`;
}

/**
 * Modelo aprovado pela Meta (fora da janela de 24h). Serve para os dois
 * lembretes: "hoje às 15:00" vale tanto 1h quanto 15 min antes.
 */
export const REMINDER_TEMPLATE_BODY =
  'Olá, {{nome}}! Lembrete do seu horário de {{servico}} hoje às {{horario}}. Se precisar remarcar, é só responder esta mensagem.';

/** Valores na ordem das variáveis do modelo ({{1}} nome, {{2}} serviço, {{3}} horário). */
export function reminderTemplateValues(p: ReminderParams): string[] {
  return [firstName(p.name) || 'cliente', p.service, p.time];
}

export function renderReminderTemplate(p: ReminderParams): string {
  const [nome, servico, horario] = reminderTemplateValues(p);
  return REMINDER_TEMPLATE_BODY.replace('{{nome}}', nome).replace('{{servico}}', servico).replace('{{horario}}', horario);
}
