import { describe, expect, it } from 'vitest';
import { planBlurb, planFeatures } from '../planFeatures';

const has = (list: string[], text: string) => list.some((l) => l.includes(text));

describe('planFeatures', () => {
  it('nenhum plano promete "em breve"', () => {
    for (const segment of ['imobiliario', 'automotivo', 'saude', 'marketing_apenas', 'geral']) {
      for (const tier of ['STARTER', 'PRO', 'ENTERPRISE'] as const) {
        expect(planFeatures(segment, tier).join(' ').toLowerCase()).not.toContain('em breve');
      }
    }
  });

  it('imobiliário: Starter abre a conversa, Pro conduz até a visita', () => {
    const starter = planFeatures('imobiliario', 'STARTER');
    const pro = planFeatures('imobiliario', 'PRO');
    expect(has(starter, 'primeiro atendimento')).toBe(true);
    expect(has(starter, 'Pedidos de visita')).toBe(false);
    expect(has(pro, 'anota pedidos de visita')).toBe(true);
    expect(has(pro, 'Pedidos de visita para o corretor confirmar')).toBe(true);
    expect(has(starter, '30 imóveis')).toBe(true);
    expect(has(pro, '150 imóveis')).toBe(true);
  });

  it('agenda (lava rápido e saúde): atendente que agenda, lembrete e financeiro em todos os planos', () => {
    for (const segment of ['automotivo', 'saude']) {
      const starter = planFeatures(segment, 'STARTER');
      expect(has(starter, 'agenda sozinha')).toBe(true);
      expect(has(starter, 'Lembrete')).toBe(true);
      expect(has(starter, 'Financeiro')).toBe(true);
      expect(has(starter, 'imóveis')).toBe(false);
    }
    // Follow-up não existe no lava rápido.
    expect(has(planFeatures('automotivo', 'PRO'), 'Follow-up')).toBe(false);
    expect(has(planFeatures('saude', 'PRO'), 'Follow-up')).toBe(true);
  });

  it('limites e serviços por plano', () => {
    expect(has(planFeatures('geral', 'STARTER'), 'Até 200 disparos/dia')).toBe(true);
    expect(has(planFeatures('geral', 'PRO'), 'Sem teto diário')).toBe(true);
    expect(has(planFeatures('geral', 'ENTERPRISE'), 'Gerente de conta dedicado')).toBe(true);
    expect(has(planFeatures('geral', 'STARTER'), 'Suporte prioritário')).toBe(false);
  });

  it('Somente Disparos: o upgrade ativa as ferramentas do ramo', () => {
    expect(has(planFeatures('marketing_apenas', 'PRO'), 'Ativa as ferramentas do seu ramo')).toBe(true);
    expect(planBlurb('marketing_apenas', 'STARTER')).toContain('Campanhas');
  });
});
