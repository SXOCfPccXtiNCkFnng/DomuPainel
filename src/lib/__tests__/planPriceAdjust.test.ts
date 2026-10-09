import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseServer', () => ({ supabaseAdmin: {} }));

import { adjustSubscriptionPrice } from '../billing';

describe('adjustSubscriptionPrice', () => {
  it('plano cujo preço de tabela não mudou não é tocado', () => {
    // Bug real: salvar o PRO reajustava assinantes do STARTER.
    expect(adjustSubscriptionPrice(197, 197, 197)).toBeNull();
  });

  it('cortesia (R$ 0) nunca recebe reajuste', () => {
    // Bug real: "vai passar de R$ 0,00 para R$ 197,00".
    expect(adjustSubscriptionPrice(0, 197, 247)).toBeNull();
  });

  it('mantém o desconto do PIX no reajuste', () => {
    // 197 no PIX = 187,15. Tabela 197 → 247: 247 no PIX = 234,65.
    expect(adjustSubscriptionPrice(187.15, 197, 247)).toBe(234.65);
  });

  it('assinante no preço cheio acompanha a tabela', () => {
    expect(adjustSubscriptionPrice(497, 497, 397)).toBe(397);
  });

  it('dois reajustes seguidos partem do valor pendente, sem empilhar errado', () => {
    const first = adjustSubscriptionPrice(377.15, 397, 447)!; // PIX
    const second = adjustSubscriptionPrice(first, 447, 497)!;
    expect(second).toBe(adjustSubscriptionPrice(377.15, 397, 497));
  });

  it('valores inválidos não geram reajuste', () => {
    expect(adjustSubscriptionPrice(Number.NaN, 197, 247)).toBeNull();
    expect(adjustSubscriptionPrice(197, 0, 247)).toBeNull();
  });
});
