'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { FlaskConical, Loader2, X } from 'lucide-react';
import { SEGMENT_LABELS, getSegmentFromStorage } from '@/lib/segmentConfig';
import { getAuthItem, setAuthItem } from '@/lib/authStorage';
import type { TenantSegment } from '@/types';

/** Evento que o onboarding escuta para pular direto para uma etapa. */
export const TEST_STEP_EVENT = 'domu:test-step';
export const TEST_ONBOARDING_KEY = 'domu_test_onboarding';

const STEP_LABELS = ['Segmento', 'Empresa', 'Conexão', 'WhatsApp', 'Plano'];

async function testAction(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch('/api/interno/test-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return json.success ? null : json.error || 'Não foi possível aplicar.';
}

/**
 * Ferramenta de testes da operação — só é renderizada para e-mails da
 * allowlist do /interno, e a API confere de novo no servidor.
 */
export default function TestModePanel({ besideSidebar = false }: { besideSidebar?: boolean }) {
  const pathname = usePathname();
  const onOnboarding = pathname === '/onboarding';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = getSegmentFromStorage();
  const onboarded = getAuthItem('domu_is_onboarded') === 'true';

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const switchSegment = (segment: TenantSegment) =>
    run(`seg:${segment}`, async () => {
      const err = await testAction({ action: 'set_segment', segment });
      if (err) return setError(err);
      setAuthItem('domu_selected_segment', segment);
      // Recarrega para o menu, títulos e travas de página usarem o módulo novo.
      window.location.href = onOnboarding ? '/onboarding' : '/';
    });

  const restartOnboarding = () => {
    setAuthItem(TEST_ONBOARDING_KEY, 'true');
    window.location.href = '/onboarding';
  };

  const leaveOnboarding = () => {
    setAuthItem(TEST_ONBOARDING_KEY, 'false');
    window.location.href = '/';
  };

  const unlockPanel = () =>
    run('unlock', async () => {
      const err = await testAction({ action: 'unlock_panel' });
      if (err) return setError(err);
      setAuthItem('domu_is_onboarded', 'true');
      setAuthItem(TEST_ONBOARDING_KEY, 'false');
      window.location.href = '/';
    });

  const goToStep = (step: number) => {
    window.dispatchEvent(new CustomEvent(TEST_STEP_EVENT, { detail: step }));
    setOpen(false);
  };

  return (
    <div className={`fixed bottom-4 left-4 z-[60] font-sans ${besideSidebar ? 'md:left-[17rem]' : ''}`}>
      {open ? (
        <div className="w-[min(20rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-amber-300">
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-400 text-amber-950 rounded-t-2xl">
            <span className="text-xs font-black flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4" /> Modo teste
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar modo teste">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {error && <p className="text-[11px] text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

            <section className="space-y-1.5">
              <h3 className="text-[11px] font-black text-slate-900">Módulo da conta</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(SEGMENT_LABELS) as TenantSegment[]).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    disabled={busy !== null || seg === current}
                    onClick={() => switchSegment(seg)}
                    className={`text-left text-[10.5px] font-bold px-2 py-1.5 rounded-lg border leading-tight disabled:cursor-default ${
                      seg === current
                        ? 'bg-domu-blue text-white border-domu-blue'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 disabled:opacity-50'
                    }`}
                  >
                    {busy === `seg:${seg}` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : SEGMENT_LABELS[seg]}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-[11px] font-black text-slate-900">Onboarding</h3>
              {onOnboarding ? (
                <>
                  <div className="grid grid-cols-5 gap-1">
                    {STEP_LABELS.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => goToStep(i + 1)}
                        title={label}
                        className="text-[10px] font-bold py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-domu-blue hover:text-domu-blue"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">{STEP_LABELS.map((l, i) => `${i + 1} ${l}`).join(' · ')}</p>
                  {onboarded ? (
                    <button
                      type="button"
                      onClick={leaveOnboarding}
                      className="w-full text-[11px] font-bold py-1.5 rounded-lg bg-slate-900 text-white"
                    >
                      Sair do onboarding e voltar ao painel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={unlockPanel}
                      disabled={busy !== null}
                      className="w-full text-[11px] font-bold py-1.5 rounded-lg bg-slate-900 text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {busy === 'unlock' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Pular tudo e liberar o painel (sem pagar)
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={restartOnboarding}
                  className="w-full text-[11px] font-bold py-1.5 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50"
                >
                  Abrir o onboarding de novo
                </button>
              )}
              <p className="text-[10px] text-amber-700 leading-snug">
                Conectar o WhatsApp e pagar dentro do onboarding gravam de verdade na sua conta. Para só ver as
                telas, pule as etapas pelos números.
              </p>
            </section>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 text-[11px] font-black px-3 py-2 rounded-full shadow-lg"
        >
          <FlaskConical className="w-4 h-4" /> Modo teste
        </button>
      )}
    </div>
  );
}
