import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { segmentTemplateDefs } from '../segmentTemplates';
import { VISIT_REMINDER_TEMPLATE_BODY } from '../visitReminderRules';
import { REMINDER_TEMPLATE_BODY } from '../appointmentReminderRules';

const SEGMENTS = ['imobiliario', 'automotivo', 'saude', 'geral', 'marketing_apenas'];

describe('modelos do ramo', () => {
  it('cada ramo recebe os seus modelos', () => {
    expect(segmentTemplateDefs('imobiliario').map((d) => d.name)).toContain('lancamento_imovel');
    expect(segmentTemplateDefs('automotivo').map((d) => d.name)).toContain('promocao_lavagem');
    expect(segmentTemplateDefs('saude').map((d) => d.name)).toContain('retorno_cliente_horario');
    expect(segmentTemplateDefs('geral').map((d) => d.name)).toContain('novidades_empresa');
    expect(segmentTemplateDefs('marketing_apenas')).toEqual(segmentTemplateDefs('geral'));
  });

  it('seguem as regras da Meta (nome, variáveis e opção de sair)', () => {
    const bodies = [
      ...SEGMENTS.flatMap((s) => segmentTemplateDefs(s)),
      { name: 'lembrete', body: REMINDER_TEMPLATE_BODY },
      { name: 'lembrete_visita', body: VISIT_REMINDER_TEMPLATE_BODY },
    ];
    for (const { name, body } of bodies) {
      expect(name).toMatch(/^[a-z0-9_]+$/);
      const trimmed = body.trim();
      // Não começa nem termina com variável.
      expect(trimmed.startsWith('{{')).toBe(false);
      expect(trimmed.endsWith('}}')).toBe(false);
      // Duas variáveis nunca grudadas (só espaço entre elas).
      expect(/\}\}\s*\{\{/.test(body)).toBe(false);
      expect(body.length).toBeLessThan(1024);
    }
    for (const s of SEGMENTS) {
      for (const def of segmentTemplateDefs(s)) expect(def.body).toContain('responda SAIR');
    }
  });

  it('nome e empresa preenchem sozinhos na campanha', () => {
    for (const def of segmentTemplateDefs('imobiliario')) {
      expect(def.body).toContain('{{nome}}');
      expect(def.body).toContain('{{empresa}}');
    }
  });
});
