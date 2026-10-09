'use client';

import { useEffect, useRef } from 'react';

/** Intervalo padrão de atualização automática das telas. */
export const AUTO_REFRESH_MS = 15_000;

/**
 * Atualiza os dados da tela sozinho, sem o usuário recarregar a página:
 * - a cada `intervalMs` enquanto a aba está visível (aba escondida não gasta nada);
 * - na hora em que o usuário volta para a aba ou janela.
 * Nunca roda duas atualizações ao mesmo tempo. `intervalMs: null` desliga o
 * intervalo e mantém só a atualização ao voltar para a aba (ex.: dados da Meta,
 * que têm limite de consultas).
 *
 * O `refresh` deve ser "silencioso" (sem spinner de carregamento), senão a tela
 * pisca a cada atualização.
 */
export function useAutoRefresh(
  refresh: () => unknown,
  options?: { intervalMs?: number | null; enabled?: boolean }
) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  const intervalMs = options?.intervalMs === undefined ? AUTO_REFRESH_MS : options.intervalMs;
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    let running = false;

    const run = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        await refreshRef.current();
      } catch {
        /* a próxima rodada tenta de novo */
      } finally {
        running = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };

    const timer = intervalMs ? window.setInterval(run, intervalMs) : null;
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled]);
}
