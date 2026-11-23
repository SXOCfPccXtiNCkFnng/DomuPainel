import { describe, expect, it } from 'vitest';
import {
  buildSalesConversation,
  nextProspectStatus,
  salesFunnel,
  sortConversations,
  stageFor,
  type SalesMessage,
  type SalesRun,
} from '../salesMonitorRules';

const now = new Date('2026-11-23T14:00:00Z');
const lead = { id: 'l1', name: 'Alan', phone: '5511934430659' };
const out = (at: string, sender = 'AGENT_PHONE'): SalesMessage => ({ direction: 'OUTBOUND', sender_type: sender, body: 'msg nossa', created_at: at });
const inn = (at: string, body = 'msg cliente'): SalesMessage => ({ direction: 'INBOUND', sender_type: null, body, created_at: at });
const run = (at: string, status: string, extra: Partial<SalesRun> = {}): SalesRun => ({ status, reason: null, tools: [], created_at: at, ...extra });

function conv(messages: SalesMessage[], runs: SalesRun[] = [], extra: Partial<Parameters<typeof buildSalesConversation>[0]> = {}) {
  return buildSalesConversation({ lead, messages, runs, account: null, business: null, now, ...extra })!;
}

describe('conversa de venda', () => {
  it('abordado que respondeu e a vendedora atendeu', () => {
    const c = conv([out('2026-11-23T12:42:00Z'), inn('2026-11-23T12:43:00Z'), out('2026-11-23T12:43:30Z', 'BOT_AI')], [
      run('2026-11-23T12:43:20Z', 'REPLIED'),
    ]);
    expect(c.approached).toBe(true);
    expect(c.stage).toBe('RESPONDEU');
    expect(c.ai).toBe('ATENDENDO');
    expect(c.lastSkip).toBeNull();
    expect(c.last.who).toBe('VENDEDORA');
  });

  it('a conversa antiga (outro assunto) não conta: só a atual', () => {
    const c = conv([inn('2026-10-25T13:00:00Z'), out('2026-11-23T12:42:00Z')]);
    expect(c.approached).toBe(true);
    expect(c.stage).toBe('ABORDADO');
    expect(c.messages).toBe(1);
  });

  it('chamou o Alan e ele ainda não respondeu: precisa de você', () => {
    const c = conv([out('2026-11-23T12:00:00Z'), inn('2026-11-23T12:05:00Z')], [
      run('2026-11-23T12:05:10Z', 'REPLIED', { tools: ['chamar_alan'] }),
    ]);
    expect(c.needsYou).toBe(true);
    const answered = conv([out('2026-11-23T12:00:00Z'), inn('2026-11-23T12:05:00Z'), out('2026-11-23T12:30:00Z')], [
      run('2026-11-23T12:05:10Z', 'REPLIED', { tools: ['chamar_alan'] }),
    ]);
    expect(answered.needsYou).toBe(false);
  });

  it('você respondeu depois do cliente: pausada por 12h; devolver tira a pausa', () => {
    const msgs = [out('2026-11-23T12:00:00Z'), inn('2026-11-23T12:05:00Z'), out('2026-11-23T13:00:00Z')];
    expect(conv(msgs).ai).toBe('PAUSADA');
    expect(conv(msgs, [], { lead: { ...lead, assistant_resumed_at: '2026-11-23T13:30:00Z' } }).ai).toBe('ATENDENDO');
  });

  it('mostra por que ela não respondeu por último', () => {
    const c = conv([out('2026-11-23T12:00:00Z'), inn('2026-11-23T12:05:00Z')], [
      run('2026-11-23T12:05:10Z', 'SKIPPED', { reason: 'HUMAN_REPLIED' }),
    ]);
    expect(c.lastSkip?.label).toContain('Você respondeu');
  });

  it('interesse e conta criada avançam a etapa', () => {
    expect(conv([out('2026-11-23T12:00:00Z'), inn('2026-11-23T12:05:00Z')], [run('2026-11-23T12:05:10Z', 'REPLIED', { tools: ['avisar_interesse'] })]).stage).toBe('INTERESSADO');
    expect(stageFor({ account: { status: 'TRIAL', price: 197 }, interested: true, replied: true })).toBe('TESTE');
    expect(stageFor({ account: { status: 'ACTIVE', price: 197 }, interested: false, replied: true })).toBe('CLIENTE');
    expect(stageFor({ account: { status: null, price: 0 }, interested: false, replied: true })).toBe('CONTA');
  });
});

describe('funil e ordem', () => {
  it('funil conta quem chegou até cada etapa, só abordados', () => {
    const a = conv([out('2026-11-23T12:00:00Z'), inn('2026-11-23T12:05:00Z')], [run('2026-11-23T12:05:10Z', 'REPLIED', { tools: ['avisar_interesse'] })]);
    const b = conv([out('2026-11-23T11:00:00Z')]);
    const spontaneous = conv([inn('2026-11-23T10:00:00Z')]);
    const f = salesFunnel([a, b, spontaneous]);
    expect(f.ABORDADO).toBe(2);
    expect(f.RESPONDEU).toBe(1);
    expect(f.INTERESSADO).toBe(1);
    expect(f.CONTA).toBe(0);
  });

  it('quem precisa de você vem primeiro', () => {
    const calm = conv([out('2026-11-23T13:00:00Z')]);
    const urgent = conv([out('2026-11-23T10:00:00Z'), inn('2026-11-23T10:05:00Z')], [run('2026-11-23T10:05:10Z', 'REPLIED', { tools: ['chamar_alan'] })]);
    expect(sortConversations([calm, urgent])[0]).toBe(urgent);
  });
});

describe('status da prospecção', () => {
  it('só avança', () => {
    expect(nextProspectStatus('CONTACTED', 'REPLIED')).toBe('REPLIED');
    expect(nextProspectStatus('INTERESTED', 'REPLIED')).toBeNull();
    expect(nextProspectStatus('REPLIED', 'CLIENT')).toBe('CLIENT');
  });

  it('"Não quer" marcado por você só muda se virar cliente', () => {
    expect(nextProspectStatus('NOT_INTERESTED', 'REPLIED')).toBeNull();
    expect(nextProspectStatus('NOT_INTERESTED', 'CLIENT')).toBe('CLIENT');
  });
});
