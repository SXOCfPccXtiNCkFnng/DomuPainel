'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, Lock } from 'lucide-react';

export default function AtendimentoPage() {
  return (
    <div className="space-y-6 w-full font-sans">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
            Em breve
          </span>
        </div>
        <h1 className="text-lg font-black text-slate-900 tracking-tight">
          Leads e Respostas
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Inbox 1:1 com respostas reais do WhatsApp. Os dados já entram via webhook —
          a interface completa chega na próxima etapa.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-black text-slate-900 flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5 text-domu-blue" />
            Atendimento em construção
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Enquanto isso, use Contatos e Métricas para acompanhar quem engajou nas campanhas.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Link href="/contatos" className="btn-domu-primary text-xs py-2 px-4">
            Ir para Contatos
          </Link>
          <Link
            href="/metricas"
            className="text-xs font-bold text-domu-blue border border-slate-200 px-4 py-2 rounded-xl hover:border-domu-blue"
          >
            Ver métricas
          </Link>
        </div>
      </div>
    </div>
  );
}
