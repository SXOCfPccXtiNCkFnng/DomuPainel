import { describe, expect, it } from 'vitest';
import { addUsage, costUsd, costUsdFullPrice, detectFlags, emptyUsage, extractBrlValues, priceFor } from '@/lib/assistantUsage';

describe('addUsage', () => {
  it('soma chamadas, conta raciocínio como saída e aceita metadata vazio', () => {
    const usage = emptyUsage();
    addUsage(usage, { promptTokenCount: 1000, candidatesTokenCount: 50, thoughtsTokenCount: 20, cachedContentTokenCount: 400 });
    addUsage(usage, undefined);
    expect(usage).toEqual({ calls: 2, input: 1000, output: 70, cached: 400 });
  });
});

describe('custo', () => {
  const usage = { calls: 1, input: 1_000_000, output: 1_000_000, cached: 0 };

  it('usa o preço promocional até 2026 e o cheio a partir de 2027', () => {
    expect(costUsd(usage, 'gemini-3.8-flash', new Date('2026-10-19T12:00:00Z'))).toBe(4.5);
    expect(costUsd(usage, 'gemini-3.8-flash', new Date('2027-01-01T00:00:00Z'))).toBe(9);
    expect(costUsdFullPrice(usage, 'gemini-3.8-flash')).toBe(9);
  });

  it('cobra a parte em cache pelo preço de cache', () => {
    const cached = { calls: 1, input: 1_000_000, output: 0, cached: 600_000 };
    expect(costUsd(cached, 'gemini-3.8-flash', new Date('2027-02-01T00:00:00Z'))).toBeCloseTo(0.4 * 1.5 + 0.6 * 0.15, 6);
  });

  it('modelo desconhecido cai no preço cheio (superestima, não esconde)', () => {
    expect(priceFor('modelo-novo')).toEqual({ input: 1.5, output: 7.5, cached: 0.15 });
  });
});

describe('extractBrlValues', () => {
  it('entende formatos brasileiros', () => {
    expect(extractBrlValues('Lavagem R$ 55,00, polimento R$1.234,50 e cera R$30')).toEqual([55, 1234.5, 30]);
  });
});

describe('detectFlags', () => {
  const base = { knownPrices: [55, 80], ownerText: 'Carro grande tem acréscimo de R$ 15,00', tools: [] as { name: string; ok: boolean }[] };

  it('não marca valores cadastrados nem os das regras da loja', () => {
    expect(detectFlags({ ...base, reply: 'A lavagem simples sai R$ 55,00 e SUV tem +R$ 15,00.' })).toEqual([]);
  });

  it('marca valor que não existe no cadastro', () => {
    expect(detectFlags({ ...base, reply: 'O polimento fica R$ 120,00.' })).toContain('VALOR_NAO_CADASTRADO');
  });

  it('marca horários oferecidos sem consultar a agenda', () => {
    expect(detectFlags({ ...base, reply: 'Tenho 09:00, 10:30 e 14h00 amanhã.' })).toContain('HORARIO_SEM_AGENDA');
    expect(
      detectFlags({ ...base, reply: 'Tenho 09:00 e 10:30 amanhã.', tools: [{ name: 'consultar_horarios_livres', ok: true }] })
    ).not.toContain('HORARIO_SEM_AGENDA');
  });

  it('um horário só (confirmação) não é sinal', () => {
    expect(detectFlags({ ...base, reply: 'Fechado, te espero às 09:00!' })).toEqual([]);
  });

  it('marca quando não sabia, chamou equipe ou a agenda falhou', () => {
    const flags = detectFlags({
      ...base,
      reply: 'Não tenho essa informação, vou chamar alguém da equipe.',
      tools: [
        { name: 'chamar_equipe', ok: true },
        { name: 'agendar', ok: false },
      ],
    });
    expect(flags).toEqual(expect.arrayContaining(['NAO_SABIA', 'CHAMOU_EQUIPE', 'ERRO_FERRAMENTA']));
  });
});
