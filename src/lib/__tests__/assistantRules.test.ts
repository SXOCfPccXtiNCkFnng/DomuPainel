import { describe, expect, it } from 'vitest';
import {
  HUMAN_PAUSE_MS,
  MAX_REPLIES_PER_HOUR,
  normalizeText,
  resolveService,
  shouldAssistantReply,
  splitReply,
  toGeminiContents,
  type HistoryMessage,
} from '@/lib/assistantRules';
import type { ServiceItem } from '@/lib/scheduling';

const now = new Date('2026-10-17T15:00:00Z');
const base = {
  enabled: true,
  automotive: true,
  pausedUntil: null,
  lastHumanReplyAt: null,
  repliesLastHour: 0,
  isOptOut: false,
  now,
};

describe('shouldAssistantReply', () => {
  it('responde no caso normal', () => {
    expect(shouldAssistantReply(base)).toEqual({ reply: true });
  });

  it('não responde desligada ou fora do segmento', () => {
    expect(shouldAssistantReply({ ...base, enabled: false })).toEqual({ reply: false, reason: 'DISABLED' });
    expect(shouldAssistantReply({ ...base, automotive: false })).toEqual({ reply: false, reason: 'WRONG_SEGMENT' });
  });

  it('fica quieta 12h depois que alguém da equipe respondeu', () => {
    const recent = new Date(now.getTime() - HUMAN_PAUSE_MS + 60_000);
    const old = new Date(now.getTime() - HUMAN_PAUSE_MS - 60_000);
    expect(shouldAssistantReply({ ...base, lastHumanReplyAt: recent })).toEqual({
      reply: false,
      reason: 'HUMAN_REPLIED',
    });
    expect(shouldAssistantReply({ ...base, lastHumanReplyAt: old })).toEqual({ reply: true });
  });

  it('respeita a pausa depois de chamar a equipe', () => {
    expect(shouldAssistantReply({ ...base, pausedUntil: new Date(now.getTime() + 1000) })).toEqual({
      reply: false,
      reason: 'PAUSED_BY_HANDOFF',
    });
    expect(shouldAssistantReply({ ...base, pausedUntil: new Date(now.getTime() - 1000) })).toEqual({ reply: true });
  });

  it('para no limite por hora e em pedido de descadastro', () => {
    expect(shouldAssistantReply({ ...base, repliesLastHour: MAX_REPLIES_PER_HOUR })).toEqual({
      reply: false,
      reason: 'RATE_LIMIT',
    });
    expect(shouldAssistantReply({ ...base, isOptOut: true })).toEqual({ reply: false, reason: 'OPT_OUT' });
  });
});

const msg = (direction: string, body: string, sender_type = 'CUSTOMER'): HistoryMessage => ({
  direction,
  sender_type,
  body,
  created_at: now.toISOString(),
});

describe('toGeminiContents', () => {
  it('junta mensagens seguidas do mesmo lado', () => {
    const contents = toGeminiContents([msg('INBOUND', 'oi'), msg('INBOUND', 'quero lavar'), msg('OUTBOUND', 'Olá!', 'BOT_AI')]);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'oi\nquero lavar' }] },
      { role: 'model', parts: [{ text: 'Olá!' }] },
    ]);
  });

  it('sempre começa pelo cliente', () => {
    const contents = toGeminiContents([msg('OUTBOUND', 'Promoção de polimento!', 'AUTOMATION'), msg('INBOUND', 'quanto?')]);
    expect(contents[0].role).toBe('user');
    expect(contents[1]).toEqual({ role: 'model', parts: [{ text: 'Promoção de polimento!' }] });
  });

  it('descreve mídia em vez de mandar "[audio]"', () => {
    const contents = toGeminiContents([msg('INBOUND', '[audio]')]);
    expect(contents[0].parts[0].text).toContain('áudio');
  });
});

describe('splitReply', () => {
  it('quebra em balões nos parágrafos e tira markdown', () => {
    expect(splitReply('**Oi!** Tudo bem?\n\nTemos horário às 10:00.')).toEqual(['Oi! Tudo bem?', 'Temos horário às 10:00.']);
  });

  it('no máximo 3 balões', () => {
    const parts = splitReply('a\n\nb\n\nc\n\nd');
    expect(parts).toEqual(['a', 'b', 'c\n\nd']);
  });

  it('texto vazio não vira mensagem', () => {
    expect(splitReply('  \n\n ')).toEqual([]);
  });
});

const service = (name: string, active = true): ServiceItem => ({
  id: name,
  name,
  description: null,
  duration_minutes: 60,
  price: null,
  active,
});

describe('resolveService', () => {
  const services = [service('Lavagem Simples'), service('Lavagem Completa'), service('Polimento'), service('Higienização', false)];

  it('acha pelo nome sem ligar para acento e maiúscula', () => {
    expect(normalizeText('  HIGIENIZAÇÃO ')).toBe('higienizacao');
    expect(resolveService(services, 'lavagem completa')).toMatchObject({ ok: true, service: { name: 'Lavagem Completa' } });
    expect(resolveService(services, 'polimento')).toMatchObject({ ok: true, service: { name: 'Polimento' } });
  });

  it('nome parcial só vale se for único', () => {
    expect(resolveService(services, 'completa')).toMatchObject({ ok: true, service: { name: 'Lavagem Completa' } });
    expect(resolveService(services, 'lavagem')).toEqual({ ok: false, options: ['Lavagem Simples', 'Lavagem Completa'] });
  });

  it('ignora serviço pausado', () => {
    expect(resolveService(services, 'higienizacao')).toEqual({
      ok: false,
      options: ['Lavagem Simples', 'Lavagem Completa', 'Polimento'],
    });
  });
});
