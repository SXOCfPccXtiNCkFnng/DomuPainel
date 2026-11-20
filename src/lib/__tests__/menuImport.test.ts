import { describe, expect, it } from 'vitest';
import { parseImportedMenu } from '../menuImport';
import { parseAiJson } from '../aiClient';
import { validateMenuItemInput } from '../pizzeria';
import { askKindFor, askSystemPrompt } from '../askAi';
import { planFeatures } from '../planFeatures';

describe('importação de cardápio', () => {
  const raw = {
    itens: [
      { categoria: 'Lanches artesanais', nome: 'X-Bacon', descricao: 'Pão, blend 160g, bacon', precos: [{ tamanho: '', preco: 29.9 }] },
      { categoria: 'pizzas', nome: 'Calabresa', precos: [{ tamanho: 'Broto', preco: 35 }, { tamanho: 'Grande', preco: '59,90' }], meio_a_meio: true },
      { categoria: 'Refrigerantes', nome: 'Coca lata', precos: [{ tamanho: '', preco: null }] },
      { categoria: 'Bebidas', nome: 'Coca lata', precos: [{ tamanho: '', preco: 6 }] },
      { categoria: 'Outros', nome: 'X' },
    ],
  };
  const items = parseImportedMenu(raw);

  it('acerta categoria, preços e meio a meio', () => {
    expect(items.find((i) => i.name === 'X-Bacon')).toMatchObject({ category: 'Lanches', needsReview: false });
    const pizza = items.find((i) => i.name === 'Calabresa')!;
    expect(pizza.category).toBe('Pizzas');
    expect(pizza.allows_half).toBe(true);
    expect(pizza.prices[1].price).toBe('59,90');
  });
  it('marca para revisão quando o preço não foi lido e ignora lixo', () => {
    const coca = items.find((i) => i.name === 'Coca lata')!;
    expect(coca.category).toBe('Bebidas');
    expect(coca.needsReview).toBe(true);
    expect(items.some((i) => i.name === 'X')).toBe(false);
  });
  it('item revisado passa na validação do cardápio', () => {
    const pizza = items.find((i) => i.name === 'Calabresa')!;
    expect(validateMenuItemInput({ ...pizza }).ok).toBe(true);
  });
  it('lê JSON mesmo dentro de bloco de código', () => {
    expect(parseAiJson('```json\n{"itens":[]}\n```')).toEqual({ itens: [] });
  });
});

describe('pergunte para a IA', () => {
  it('sabe o tipo de dado de cada ramo', () => {
    expect(askKindFor('alimentacao')).toBe('pedidos');
    expect(askKindFor('saude')).toBe('agenda');
    expect(askKindFor('imobiliario')).toBe('imobiliario');
    expect(askKindFor('marketing_apenas')).toBeNull();
    expect(askSystemPrompt('Burger do Zé', 'pedidos')).toContain('Nunca invente');
  });
  it('aparece na lista do Pro, não no Starter', () => {
    expect(planFeatures('alimentacao', 'PRO').join(' ')).toContain('Pergunte para a IA');
    expect(planFeatures('alimentacao', 'STARTER').join(' ')).not.toContain('Pergunte para a IA');
  });
});
