import { after } from 'next/server';
import { isProduction } from '@/lib/envSecrets';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

/** Mesmo evento repetido em sequência: grava no máximo 1 vez a cada 30s, somando o contador. */
const PERSIST_THROTTLE_MS = 30_000;
const pending = new Map<string, { count: number; lastWrite: number }>();

function messageFrom(event: string, fields?: LogFields): string {
  const raw = fields?.message ?? fields?.error ?? fields?.reason;
  if (raw != null && String(raw).trim()) return String(raw);
  if (fields?.status != null) return `${event} (status ${String(fields.status)})`;
  return event;
}

/**
 * Erros e avisos do servidor vão também para o painel /interno (agrupados),
 * não só para o log da hospedagem — senão ninguém fica sabendo.
 */
function persist(level: 'warn' | 'error', event: string, fields?: LogFields) {
  if (typeof window !== 'undefined') return;

  const key = `${level}|${event}`;
  const now = Date.now();
  const state = pending.get(key) || { count: 0, lastWrite: 0 };
  state.count += 1;
  if (now - state.lastWrite < PERSIST_THROTTLE_MS) {
    pending.set(key, state);
    return;
  }
  const count = state.count;
  pending.set(key, { count: 0, lastWrite: now });

  const write = () =>
    import('@/lib/opsAlert')
      .then((m) =>
        m.recordOpsEvent({
          source: event,
          level,
          message: messageFrom(event, fields),
          tenantId: typeof fields?.tenantId === 'string' ? fields.tenantId : null,
          meta: fields,
          count,
        })
      )
      .catch(() => {
        /* registrar não pode quebrar quem chamou */
      });

  // Em serverless, after() garante que a gravação termine depois da resposta.
  try {
    after(write);
  } catch {
    void write(); // fora de uma requisição (script, teste)
  }
}

function emit(level: LogLevel, event: string, fields?: LogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug' && isProduction()) return;
  else console.log(line);

  if (level === 'error' || level === 'warn') persist(level, event, fields);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
