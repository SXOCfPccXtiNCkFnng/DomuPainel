'use client';

import React from 'react';
import { X } from 'lucide-react';

/** Aviso de recurso ainda em construção — vale para todos os planos. */
export default function ComingSoonModal({
  open,
  title,
  onClose,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md bg-white border border-slate-200 shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Em breve</p>
            <h3 className="text-base font-bold text-slate-900 mt-1">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Estamos finalizando esse recurso e ele será liberado em breve. Enquanto isso, você já dispara
          campanhas, importa contatos e acompanha entrega e resposta.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onClose} className="btn-domu-primary text-sm py-2.5 px-4">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
