import { describe, expect, it } from 'vitest';
import {
  conversationSchedule,
  DEFAULT_FOLLOW_UP_SETTINGS,
  firstName,
  formatDelay,
  isFollowUpCompatibleTemplate,
  isOriginEnabled,
  nextAllowedSendTime,
  parseFollowUpMessage,
  renderFollowUpText,
  validateFollowUpFields,
} from '../followUpRules';
import { checkContextByKeywords, type ConversationMessage } from '../followUpContext';

const window8to20 = { window_start_hour: 8, window_end_hour: 20, skip_weekends: false };
// Horário de Brasília = UTC-3.
const brt = (iso: string) => new Date(`${iso}-03:00`);
const HOUR = 60 * 60 * 1000;

describe('conversationSchedule (janela de 24h do WhatsApp)', () => {
  it('janela conta da última mensagem DO CONTATO e o envio sai até 1h antes de fechar', () => {
    const contact = brt('2026-10-07T10:00:00');
    const ours = brt('2026-10-07T14:00:00');
    const s = conversationSchedule(ours, contact, 24)!;
    expect(s.deadlineAt).toEqual(brt('2026-10-08T09:00:00'));
    expect(s.dueAt).toEqual(brt('2026-10-08T09:00:00')); // 24h depois da nossa passaria da janela
  });

  it('tempo curto cabe na janela: sai no tempo escolhido', () => {
    const contact = brt('2026-10-07T10:00:00');
    const ours = brt('2026-10-07T10:30:00');
    expect(conversationSchedule(ours, contact, 4)!.dueAt).toEqual(new Date(ours.getTime() + 4 * HOUR));
  });

  it('sem mensagem do contato (janela nunca abriu): não agenda', () => {
    expect(conversationSchedule(new Date(), null, 24)).toBeNull();
  });

  it('janela já fechando: não agenda', () => {
    const contact = brt('2026-10-07T10:00:00');
    const ours = brt('2026-10-08T08:55:00');
    expect(conversationSchedule(ours, contact, 1)).toBeNull();
  });
});

describe('nextAllowedSendTime', () => {
  it('dentro do horário: envia na hora', () => {
    const at = brt('2026-10-07T10:30:00');
    expect(nextAllowedSendTime(at, window8to20)).toEqual(at);
  });

  it('de madrugada: espera até o início do horário', () => {
    expect(nextAllowedSendTime(brt('2026-10-07T03:15:00'), window8to20)).toEqual(brt('2026-10-07T08:00:00'));
  });

  it('sem fim de semana: sábado pula para segunda', () => {
    expect(nextAllowedSendTime(brt('2026-10-10T11:00:00'), { ...window8to20, skip_weekends: true })).toEqual(
      brt('2026-10-12T08:00:00')
    );
  });
});

describe('parseFollowUpMessage', () => {
  it('conversa: texto livre, pode começar com o nome', () => {
    const r = parseFollowUpMessage('{{Nome}}, conseguiu ver?', { forTemplate: false });
    expect(r).toEqual({ ok: true, text: '{{nome}}, conseguiu ver?', params: [{ source: 'contact_name' }] });
  });

  it('campanha: aplica as regras da Meta', () => {
    expect(parseFollowUpMessage('{{nome}}, conseguiu ver minha mensagem?', { forTemplate: true }).ok).toBe(false);
    expect(parseFollowUpMessage('Conseguiu ver minha mensagem, {{nome}}', { forTemplate: true }).ok).toBe(false);
    expect(parseFollowUpMessage('Oi {{nome}} {{empresa}} aqui, conseguiu ver?', { forTemplate: true }).ok).toBe(false);
    expect(parseFollowUpMessage('Oi {{nome}}!', { forTemplate: true }).ok).toBe(false);
    expect(parseFollowUpMessage('Oi {{nome}}, aqui é da {{empresa}}. Conseguiu ver?', { forTemplate: true }).ok).toBe(true);
  });

  it('recusa variável desconhecida e texto vazio', () => {
    expect(parseFollowUpMessage('Oi {{cliente}}, tudo bem?', { forTemplate: false }).ok).toBe(false);
    expect(parseFollowUpMessage('   ', { forTemplate: false }).ok).toBe(false);
  });
});

describe('renderFollowUpText', () => {
  it('usa só o primeiro nome', () => {
    expect(renderFollowUpText('Oi {{nome}}, tudo bem?', { contactName: 'MARIA souza' })).toBe('Oi Maria, tudo bem?');
  });

  it('sem nome conhecido, o {{nome}} some sem deixar sobra', () => {
    expect(renderFollowUpText('Oi {{nome}}, tudo bem?', { contactName: 'Contato WhatsApp' })).toBe('Oi, tudo bem?');
    expect(renderFollowUpText('{{nome}}, conseguiu ver?', { contactName: null })).toBe('Conseguiu ver?');
    expect(renderFollowUpText('Tudo certo, {{nome}}?', { contactName: '' })).toBe('Tudo certo?');
  });

  it('preenche a empresa', () => {
    expect(renderFollowUpText('Aqui é da {{empresa}}.', { companyName: 'Imob X' })).toBe('Aqui é da Imob X.');
  });
});

describe('firstName', () => {
  it('ignora nomes genéricos', () => {
    expect(firstName('Contato Importado')).toBeNull();
    expect(firstName('  joão  pedro ')).toBe('João');
  });
});

describe('checkContextByKeywords', () => {
  const conv = (...pairs: [ConversationMessage['direction'], string][]): ConversationMessage[] =>
    pairs.map(([direction, body], i) => ({ direction, body, created_at: new Date(Date.now() - (10 - i) * 60000).toISOString() }));

  it('despedida barra', () => {
    const v = checkContextByKeywords(conv(['INBOUND', 'Valeu, obrigado pelo atendimento!'], ['OUTBOUND', 'Imagina! Até mais']));
    expect(v && v.ok && v.send).toBe(false);
  });

  it('negócio fechado barra', () => {
    const v = checkContextByKeywords(conv(['INBOUND', 'Pix enviado, segue o comprovante'], ['OUTBOUND', 'Recebido, obrigado!']));
    expect(v && v.ok && v.category).toBe('NEGOCIO_FECHADO');
  });

  it('contato vai retornar barra', () => {
    const v = checkContextByKeywords(conv(['INBOUND', 'Vou pensar e te falo amanhã'], ['OUTBOUND', 'Perfeito!']));
    expect(v && v.ok && v.category).toBe('CONTATO_VAI_RETORNAR');
  });

  it('empresa ficou de responder barra', () => {
    const v = checkContextByKeywords(conv(['INBOUND', 'Tem vaga de garagem?'], ['OUTBOUND', 'Vou verificar e te retorno']));
    expect(v && v.ok && v.category).toBe('EMPRESA_DEVE_RESPONDER');
  });

  it('pergunta pendente passa para a IA (sem veredito por palavras)', () => {
    expect(
      checkContextByKeywords(conv(['INBOUND', 'Qual o valor do apartamento?'], ['OUTBOUND', 'R$ 450 mil. Quer agendar uma visita?']))
    ).toBeNull();
  });
});

describe('validateFollowUpFields', () => {
  const valid = {
    conversation_enabled: true,
    conversation_delay_hours: 24,
    campaign_enabled: false,
    campaign_delay_hours: 48,
    window_start_hour: 8,
    window_end_hour: 20,
    excluded_statuses: ['FECHADO'],
  };

  it('aceita configuração válida e liga a IA por padrão', () => {
    const r = validateFollowUpFields(valid);
    expect(r.ok && r.fields.ai_check_enabled).toBe(true);
  });

  it('recusa tempos fora das opções', () => {
    expect(validateFollowUpFields({ ...valid, conversation_delay_hours: 30 }).ok).toBe(false);
    expect(validateFollowUpFields({ ...valid, campaign_delay_hours: 5 }).ok).toBe(false);
  });

  it('recusa horário invertido', () => {
    expect(validateFollowUpFields({ ...valid, window_start_hour: 20, window_end_hour: 8 }).ok).toBe(false);
  });
});

describe('isOriginEnabled', () => {
  it('cada tipo é ligado separadamente e precisa de mensagem', () => {
    const s = { ...DEFAULT_FOLLOW_UP_SETTINGS, conversation_enabled: true, conversation_message: 'Oi {{nome}}' };
    expect(isOriginEnabled(s, 'CONVERSATION')).toBe(true);
    expect(isOriginEnabled(s, 'CAMPAIGN')).toBe(false);
    expect(isOriginEnabled({ ...s, conversation_message: ' ' }, 'CONVERSATION')).toBe(false);
  });
});

describe('isFollowUpCompatibleTemplate', () => {
  it('só aprovado e sem mídia no cabeçalho', () => {
    expect(isFollowUpCompatibleTemplate({ status: 'APPROVED', header_type: 'NONE' })).toBe(true);
    expect(isFollowUpCompatibleTemplate({ status: 'APPROVED', header_type: 'IMAGE' })).toBe(false);
    expect(isFollowUpCompatibleTemplate({ status: 'PENDING', header_type: 'NONE' })).toBe(false);
  });
});

describe('formatDelay', () => {
  it('mostra horas e dias', () => {
    expect(formatDelay(1)).toBe('1 hora');
    expect(formatDelay(24)).toBe('24 horas');
    expect(formatDelay(48)).toBe('2 dias');
  });
});
