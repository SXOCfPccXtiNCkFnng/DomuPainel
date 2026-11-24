import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({ supabaseAdmin: {} }));

import { simulateTool } from '../assistantRunner';

/** Ferramenta "de verdade" falsa: registra o que foi chamado. */
function fakeReal(responses: Record<string, Record<string, unknown>>) {
  const calls: string[] = [];
  const real = vi.fn(async (name: string) => {
    calls.push(name);
    return responses[name] ?? { ok: true };
  });
  return { real, calls };
}

describe('simulador da atendente: nada é gravado nem enviado', () => {
  it('agendar confere o horário livre de verdade, mas não grava', async () => {
    const { real, calls } = fakeReal({
      consultar_horarios_livres: { servico: 'Corte masculino', dia_da_semana: 'quinta', horarios_livres: ['14:00', '15:00'] },
    });
    const actions: string[] = [];
    const ok = await simulateTool('agendar', { servico: 'corte', data: '2026-11-26', horario: '14:00' }, real, actions);
    expect(ok.ok).toBe(true);
    expect(calls).toEqual(['consultar_horarios_livres']); // nunca chamou o agendar real
    expect(actions[0]).toContain('Marcaria Corte masculino em 26/11 às 14:00');

    const busy = await simulateTool('agendar', { servico: 'corte', data: '2026-11-26', horario: '16:00' }, real, []);
    expect(busy.ok).toBe(false);
  });

  it('pedido usa o cálculo de verdade e não manda para a cozinha', async () => {
    const { real, calls } = fakeReal({ calcular_pedido: { ok: true, total: 'R$ 85,00' } });
    const actions: string[] = [];
    const r = await simulateTool('registrar_pedido', { itens: [], tipo: 'entrega' }, real, actions);
    expect(r).toMatchObject({ ok: true, pedido: { numero: 'TESTE' } });
    expect(calls).toEqual(['calcular_pedido']);
    expect(actions[0]).toContain('R$ 85,00');
  });

  it('chamar a equipe, pedir visita, anotar interesse e cancelar: só fingem', async () => {
    const { real, calls } = fakeReal({});
    const actions: string[] = [];
    for (const name of ['chamar_equipe', 'chamar_corretor', 'perguntar_equipe', 'solicitar_visita', 'registrar_interesse', 'cancelar_agendamento']) {
      await simulateTool(name, { motivo: 'teste', imovel_codigo: 'AP01' }, real, actions);
    }
    expect(calls).toEqual([]);
    expect(actions.length).toBe(5);
  });

  it('consultas passam direto (agenda, cardápio, imóveis)', async () => {
    const { real, calls } = fakeReal({ ver_cardapio: { itens: [] } });
    await simulateTool('ver_cardapio', { busca: 'calabresa' }, real, []);
    await simulateTool('buscar_imoveis', {}, real, []);
    expect(calls).toEqual(['ver_cardapio', 'buscar_imoveis']);
  });
});
