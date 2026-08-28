'use client';

import React from 'react';
import { ShieldCheck, Smartphone, CheckCircle2 } from 'lucide-react';
import { mockTenants } from '@/lib/mockData';

export default function CoexistenceWidget() {
  const tenant = mockTenants[0];

  return (
    <div className="card-domu p-5 bg-gradient-to-br from-white via-slate-50 to-blue-50/30 border border-blue-100">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-extrabold uppercase tracking-wide bg-domu-blue/10 text-domu-blue border border-domu-blue/30">
              WhatsApp Coexistence Mode (Oficial Meta)
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-sm border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Quality Score: VERDE
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            Número Conectado: <span className="font-mono text-domu-blue">{tenant.whatsappNumber}</span>
          </h4>

          <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
            Seu aplicativo <strong>WhatsApp Business no celular</strong> está sincronizado simultaneamente com a <strong>Cloud API do Portal DOMU</strong>. Você pode fazer conversas manuais 1 a 1 no celular enquanto o SaaS executa os disparos automáticos sem risco de bloqueio.
          </p>
        </div>

        {/* Right Status & Rule Tracker */}
        <div className="bg-white p-3.5 rounded-sm border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full lg:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-sm bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Regra dos 14 Dias (Celular)</p>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                Último check-in: <span className="text-domu-blue">há 3 dias</span>
              </p>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-slate-200 hidden sm:block"></div>

          <div className="text-left w-full sm:w-auto">
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Sessão Ativa por mais 11 dias
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Basta abrir o WhatsApp no celular semanalmente</p>
          </div>
        </div>

      </div>
    </div>
  );
}
