import { describe, expect, it } from 'vitest';
import {
  buildBodyComponent,
  defaultParams,
  extractTemplateVariables,
  renderWithParams,
  validateTemplateParams,
} from '../templateParams';

describe('extractTemplateVariables', () => {
  it('lê variáveis nomeadas na ordem da primeira aparição (mesma ordem enviada à Meta)', () => {
    expect(
      extractTemplateVariables('Olá {{nome}}, sua consulta é {{data}} às {{horario}}. Até {{data}}!')
    ).toEqual(['nome', 'data', 'horario']);
  });

  it('ordena numericamente templates no formato da Meta', () => {
    expect(extractTemplateVariables('{{2}} e {{1}} e {{10}}')).toEqual(['1', '2', '10']);
  });

  it('template sem variável', () => {
    expect(extractTemplateVariables('Promoção de hoje!')).toEqual([]);
  });
});

describe('defaultParams', () => {
  it('sugere nome do contato, empresa e exige texto para o resto', () => {
    expect(defaultParams(['nome', 'empresa', 'data'])).toEqual([
      { source: 'contact_name' },
      { source: 'company_name' },
      { source: 'fixed', value: '' },
    ]);
    // "Olá {{1}}" — convenção da Meta: a primeira é o nome.
    expect(defaultParams(['1', '2'])).toEqual([
      { source: 'contact_name' },
      { source: 'fixed', value: '' },
    ]);
  });
});

describe('validateTemplateParams', () => {
  const vars = ['nome', 'data'];

  it('recusa texto fixo vazio (antes: ia o nome do contato em todas)', () => {
    const r = validateTemplateParams(vars, defaultParams(vars));
    expect(r.ok).toBe(false);
  });

  it('aplica as regras da Meta para parâmetro de texto', () => {
    expect(
      validateTemplateParams(vars, [{ source: 'contact_name' }, { source: 'fixed', value: 'a\nb' }]).ok
    ).toBe(false);
    expect(
      validateTemplateParams(vars, [{ source: 'contact_name' }, { source: 'fixed', value: 'a     b' }]).ok
    ).toBe(false);
  });

  it('recusa quantidade diferente de variáveis', () => {
    expect(validateTemplateParams(vars, [{ source: 'contact_name' }]).ok).toBe(false);
  });

  it('aceita e limpa valores válidos', () => {
    const r = validateTemplateParams(vars, [
      { source: 'contact_name', value: 'ignorado' },
      { source: 'fixed', value: '  15/10  ' },
    ]);
    expect(r).toEqual({ ok: true, params: [{ source: 'contact_name' }, { source: 'fixed', value: '15/10' }] });
  });
});

describe('buildBodyComponent', () => {
  it('monta um valor diferente para cada variável', () => {
    const comp = buildBodyComponent(
      [{ source: 'contact_name' }, { source: 'fixed', value: '15/10' }, { source: 'company_name' }],
      { contactName: 'Maria', companyName: 'Barbearia do Zé' }
    );
    expect(comp?.[0].parameters.map((p) => p.text)).toEqual(['Maria', '15/10', 'Barbearia do Zé']);
  });

  it('usa "Cliente" quando o contato não tem nome real', () => {
    const comp = buildBodyComponent([{ source: 'contact_name' }], { contactName: 'Contato Importado' });
    expect(comp?.[0].parameters[0].text).toBe('Cliente');
  });

  it('sem variáveis não manda componente', () => {
    expect(buildBodyComponent([], { contactName: 'Maria' })).toBeUndefined();
  });
});

describe('renderWithParams', () => {
  it('mostra no preview exatamente o que vai sair', () => {
    expect(
      renderWithParams('Olá {{nome}}, consulta {{data}}', ['nome', 'data'], ['Maria', '15/10'])
    ).toBe('Olá Maria, consulta 15/10');
  });
});
