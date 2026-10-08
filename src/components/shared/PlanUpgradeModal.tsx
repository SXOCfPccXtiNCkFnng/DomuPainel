'use client';

import React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function PlanUpgradeModal({
  open,
  title,
  detail,
  onClose,
}: {
  open: boolean;
  title: string;
  detail: string;
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue">Plano Pro</p>
            <h3 className="text-base font-bold text-slate-900 mt-1">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{detail}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/assinatura" onClick={onClose} className="btn-domu-primary text-sm py-2.5 px-4">
            Ver plano Pro
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
