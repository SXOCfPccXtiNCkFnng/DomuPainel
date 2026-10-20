'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (botão vermelho). */
  tone?: 'danger' | 'default';
};

/**
 * Confirmação no visual do painel, no lugar do window.confirm do navegador.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: 'Excluir?' }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = options ? <ConfirmDialog {...options} onClose={close} /> : null;
  return { confirm, confirmDialog };
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = tone === 'danger';

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button type="button" aria-label={cancelLabel} className="absolute inset-0 bg-slate-950/50" onClick={() => onClose(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-domu-blue'
            }`}
          >
            {danger ? <AlertTriangle className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
          </span>
          <div className="space-y-1 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-sm font-black text-slate-900">
              {title}
            </h2>
            {message ? <div className="text-xs text-slate-600 leading-relaxed">{message}</div> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={
              danger
                ? 'px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700'
                : 'btn-domu-primary text-xs py-2 px-4'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
