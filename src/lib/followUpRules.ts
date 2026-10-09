/**
 * Regras do follow-up automático sem dependência de banco — usadas pela tela,
 * pela API e pelo envio, e testáveis isoladamente.
 *
 * CONVERSA: contato escreveu nas últimas 24h (janela aberta) → texto livre.
 * CAMPANHA: recebeu campanha e nunca respondeu → template aprovado pela Meta.
 */
import { extractTemplateVariables, type TemplateParam } from '@/lib/templateParams';

export type FollowUpOrigin = 'CONVERSATION' | 'CAMPAIGN';

export type FollowUpSettings = {
  conversation_enabled: boolean;
  conversation_message: string;
  conversation_delay_hours: number;

  campaign_enabled: boolean;
  campaign_message: string;
  campaign_delay_hours: number;
  template_id: string | null;
  template_params: TemplateParam[];
  template_note: string | null;

  ai_check_enabled: boolean;
  excluded_statuses: string[];
  window_start_hour: number;
  window_end_hour: number;
  skip_weekends: boolean;
};

export const DEFAULT_FOLLOW_UP_SETTINGS: FollowUpSettings = {
  conversation_enabled: false,
  conversation_message: '',
  conversation_delay_hours: 24,
  campaign_enabled: false,
  campaign_message: '',
  campaign_delay_hours: 24,
  template_id: null,
  template_params: [],
  template_note: null,
  ai_check_enabled: true,
  excluded_statuses: ['FECHADO'],
  window_start_hour: 8,
  window_end_hour: 20,
  skip_weekends: false,
};

/** Conversa: no máximo até a janela fechar (o envio sai antes das 24h de qualquer jeito). */
export const CONVERSATION_DELAY_OPTIONS = [1, 2, 4, 6, 12, 24] as const;
export const CAMPAIGN_DELAY_OPTIONS = [12, 24, 48, 72] as const;

/** A janela do WhatsApp dura 24h; o follow-up sai até 1h antes de fechar. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const WINDOW_SAFETY_MS = 60 * 60 * 1000;

export type FollowUpStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'REPLIED'
  | 'CANCELLED'
  | 'SKIPPED'
  | 'FAILED';

export type FollowUpSkipCode =
  | 'CONTEXT'
  | 'WINDOW_CLOSED'
  | 'OPT_OUT'
  | 'PAUSED'
  | 'STATUS'
  | 'NOT_WAITING'
  | 'OTHER';

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING: 'Agendado',
  PROCESSING: 'Enviando',
  SENT: 'Enviado',
  REPLIED: 'Respondeu antes',
  CANCELLED: 'Cancelado',
  SKIPPED: 'Evitado',
  FAILED: 'Falhou',
};

/** Campos que o cliente pode colocar na mensagem. */
export const FOLLOW_UP_TOKENS = [
  { token: '{{nome}}', label: 'Nome do contato', source: 'contact_name' },
  { token: '{{empresa}}', label: 'Nome da sua empresa', source: 'company_name' },
] as const;

export const FOLLOW_UP_MESSAGE_MAX = 1024;

/** Mensagens sugeridas que já vêm preenchidas na tela (o cliente pode editar). */
export const SUGGESTED_CONVERSATION_MESSAGE =
  'Oi {{nome}}, tudo bem? Vi que você não respondeu minha última mensagem. Ficou com alguma dúvida? Estou à disposição para te ajudar!';
export const SUGGESTED_CAMPAIGN_MESSAGE =
  'Oi {{nome}}, tudo bem? Aqui é da {{empresa}}. Vi que você recebeu nossa mensagem. Posso te ajudar com alguma dúvida?';

export function hasNameToken(message: string): boolean {
  return /\{\{\s*nome\s*\}\}/i.test(message);
}

/** Nome dos templates criados pelo follow-up (ficam fora da tela de Templates). */
export const FOLLOW_UP_TEMPLATE_PREFIX = 'domu_followup_';

export function formatDelay(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '24 horas' : `${days} dias`;
  }
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

export function isOriginEnabled(settings: FollowUpSettings, origin: FollowUpOrigin): boolean {
  if (origin === 'CONVERSATION') {
    return settings.conversation_enabled && Boolean(settings.conversation_message.trim());
  }
  return settings.campaign_enabled && Boolean(settings.template_id);
}

/**
 * Confere o texto do follow-up. `forTemplate`: campanha — o texto vira
 * template, então valem as regras que fazem a Meta reprovar.
 */
export function parseFollowUpMessage(
  raw: unknown,
  options: { forTemplate: boolean }
): { ok: true; text: string; params: TemplateParam[] } | { ok: false; error: string } {
  const text = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, name: string) => `{{${name.trim().toLowerCase()}}}`);

  if (!text) return { ok: false, error: 'Escreva a mensagem do follow-up.' };
  if (text.length > FOLLOW_UP_MESSAGE_MAX) {
    return { ok: false, error: `A mensagem pode ter no máximo ${FOLLOW_UP_MESSAGE_MAX} caracteres.` };
  }

  const variables = extractTemplateVariables(text);
  const allowed = new Map<string, TemplateParam>(
    FOLLOW_UP_TOKENS.map((t) => [t.token.slice(2, -2), { source: t.source }])
  );
  const unknown = variables.find((v) => !allowed.has(v));
  if (unknown) {
    return { ok: false, error: `"{{${unknown}}}" não existe. Use só {{nome}} e {{empresa}}.` };
  }

  if (options.forTemplate) {
    // Regras da Meta: variável não pode abrir nem fechar o texto, nem ficar colada em outra.
    if (/^\{\{/.test(text) || /\}\}$/.test(text)) {
      return {
        ok: false,
        error: 'A mensagem não pode começar nem terminar com {{nome}}/{{empresa}} (regra da Meta). Ex.: "Oi {{nome}}, tudo bem?"',
      };
    }
    if (/\}\}\s*\{\{/.test(text)) {
      return { ok: false, error: 'Coloque algum texto entre {{nome}} e {{empresa}} (regra da Meta).' };
    }
    if (text.replace(/\{\{[^}]+\}\}/g, '').trim().length < 15) {
      return { ok: false, error: 'Escreva uma mensagem um pouco maior — a Meta reprova textos muito curtos.' };
    }
  }

  return { ok: true, text, params: variables.map((v) => allowed.get(v)!) };
}

const PLACEHOLDER_NAMES = new Set(['contato whatsapp', 'contato importado', 'cliente', '']);

/** Primeiro nome "de verdade" do contato, ou null se só temos um nome genérico. */
export function firstName(name: string | null | undefined): string | null {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (PLACEHOLDER_NAMES.has(clean.toLowerCase())) return null;
  const first = clean.split(' ')[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null;
}

/**
 * Texto final do follow-up de conversa. Sem nome conhecido, o {{nome}} some
 * sem deixar sobra ("Oi {{nome}}, tudo bem?" → "Oi, tudo bem?").
 */
export function renderFollowUpText(
  message: string,
  ctx: { contactName?: string | null; companyName?: string | null }
): string {
  const name = firstName(ctx.contactName);
  let out = message.replace(/\{\{\s*empresa\s*\}\}/gi, (ctx.companyName || '').trim() || 'nossa equipe');
  out = name
    ? out.replace(/\{\{\s*nome\s*\}\}/gi, name)
    : out
        .replace(/[ \t]*\{\{\s*nome\s*\}\}/gi, '')
        .replace(/^[\s,]+/, '')
        .replace(/[ \t]+([,.!?])/g, '$1')
        .replace(/,(\s*[,.!?])/g, '$1');
  out = out.replace(/[ \t]{2,}/g, ' ').trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Confere os campos simples vindos da tela (mensagens e template são
 * validados à parte, na API).
 */
export function validateFollowUpFields(input: Record<string, unknown>):
  | {
      ok: true;
      fields: Pick<
        FollowUpSettings,
        | 'conversation_enabled'
        | 'conversation_delay_hours'
        | 'campaign_enabled'
        | 'campaign_delay_hours'
        | 'ai_check_enabled'
        | 'excluded_statuses'
        | 'window_start_hour'
        | 'window_end_hour'
        | 'skip_weekends'
      >;
    }
  | { ok: false; error: string } {
  const convDelay = Number(input.conversation_delay_hours);
  if (!(CONVERSATION_DELAY_OPTIONS as readonly number[]).includes(convDelay)) {
    return { ok: false, error: 'Escolha um tempo de espera válido para conversas.' };
  }
  const campDelay = Number(input.campaign_delay_hours);
  if (!(CAMPAIGN_DELAY_OPTIONS as readonly number[]).includes(campDelay)) {
    return { ok: false, error: 'Escolha um tempo de espera válido para campanhas.' };
  }
  const start = Number(input.window_start_hour);
  const end = Number(input.window_end_hour);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 24 || start >= end) {
    return { ok: false, error: 'O horário de início precisa ser antes do horário de fim.' };
  }
  if (end - start < 2) {
    return { ok: false, error: 'Deixe pelo menos 2 horas de horário de envio.' };
  }
  const statuses = Array.isArray(input.excluded_statuses)
    ? input.excluded_statuses.map((s) => String(s).toUpperCase()).filter((s) => /^[A-Z_]{2,40}$/.test(s))
    : [];
  return {
    ok: true,
    fields: {
      conversation_enabled: Boolean(input.conversation_enabled),
      conversation_delay_hours: convDelay,
      campaign_enabled: Boolean(input.campaign_enabled),
      campaign_delay_hours: campDelay,
      ai_check_enabled: input.ai_check_enabled !== false,
      excluded_statuses: [...new Set(statuses)].slice(0, 20),
      window_start_hour: start,
      window_end_hour: end,
      skip_weekends: Boolean(input.skip_weekends),
    },
  };
}

/** Templates com mídia no cabeçalho precisam de arquivo a cada envio — fora do follow-up. */
export function isFollowUpCompatibleTemplate(t: {
  status?: string | null;
  header_type?: string | null;
}): boolean {
  const header = String(t.header_type || 'NONE').toUpperCase();
  return t.status === 'APPROVED' && (header === 'NONE' || header === 'TEXT');
}

/**
 * Quando sai o follow-up de conversa: `delay` depois da nossa mensagem, mas
 * nunca depois de 23h da última mensagem do contato (a janela fecha em 24h).
 * Retorna null se a janela já estiver fechada (ou fechando).
 */
export function conversationSchedule(
  ourMessageAt: Date,
  lastInboundAt: Date | null,
  delayHours: number
): { dueAt: Date; deadlineAt: Date } | null {
  if (!lastInboundAt) return null;
  const deadline = new Date(lastInboundAt.getTime() + WINDOW_MS - WINDOW_SAFETY_MS);
  const wanted = new Date(ourMessageAt.getTime() + delayHours * 60 * 60 * 1000);
  const dueAt = wanted < deadline ? wanted : deadline;
  // Menos de 15 min entre a nossa mensagem e o envio: cedo demais, não agenda.
  if (dueAt.getTime() - ourMessageAt.getTime() < 15 * 60 * 1000) return null;
  return { dueAt, deadlineAt: deadline };
}

// Horário de Brasília: UTC-3 fixo (o Brasil não tem horário de verão desde 2019).
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type SendWindow = Pick<FollowUpSettings, 'window_start_hour' | 'window_end_hour' | 'skip_weekends'>;

function isAllowedAt(date: Date, window: SendWindow): boolean {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  const hour = local.getUTCHours();
  const day = local.getUTCDay();
  if (window.skip_weekends && (day === 0 || day === 6)) return false;
  return hour >= window.window_start_hour && hour < window.window_end_hour;
}

/** Primeiro momento a partir de `from` dentro do horário de envio (Brasília). */
export function nextAllowedSendTime(from: Date, window: SendWindow): Date {
  if (isAllowedAt(from, window)) return from;
  let candidate = new Date(Math.floor(from.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS);
  for (let i = 0; i < 24 * 8; i += 1) {
    if (isAllowedAt(candidate, window)) return candidate;
    candidate = new Date(candidate.getTime() + HOUR_MS);
  }
  return candidate;
}
