'use client';

import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Bloco recolhível: mostra só o título e abre o conteúdo ao clicar. Usado para
 * deixar à vista o essencial e guardar explicações/detalhes técnicos.
 */
export default function Disclosure({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-start gap-3 min-w-0">
          {icon ? (
            <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-900">{title}</span>
            {subtitle ? <span className="block text-[11px] text-slate-500 mt-0.5">{subtitle}</span> : null}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={contentId} className="px-5 pb-5 pt-1 border-t border-slate-100">
          {children}
        </div>
      ) : null}
    </div>
  );
}
