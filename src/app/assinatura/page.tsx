'use client';

import React from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, Zap, ArrowUpRight, Sparkles, Building2, Phone } from 'lucide-react';

export default function AssinaturaPage() {
  return (
    <div className="space-y-6 w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200">
              SaaS Multi-Tenant
            </span>
            <span className="text-xs text-slate-500 font-medium">Gestão de Conta e Faturamento</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Assinatura e Planos do DOMU Tech
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Assinatura Ativa • Renovação em 18/09</span>
          </span>
        </div>
      </div>

      {/* Active Plan Summary Card */}
      <div className="bg-gradient-to-r from-domu-navy via-slate-900 to-domu-navy text-white rounded-md p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase bg-domu-blue text-white px-2 py-0.5 rounded">
              SEU PLANO ATUAL
            </span>
            <h2 className="text-xl font-black text-white mt-1.5">Plano Pro</h2>
            <p className="text-xs text-slate-300">Inclui Coexistência Celular + Web e Meta Cloud API Oficial</p>
          </div>

          <div className="text-left md:text-right">
            <span className="text-2xl font-black text-white">R$ 497</span>
            <span className="text-xs text-slate-400 font-medium"> / mês</span>
            <p className="text-[11px] text-slate-400">Cobrado mensalmente no cartão ** **** 8821</p>
          </div>
        </div>

        {/* Usage Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
          <div className="bg-slate-800/60 p-3 rounded border border-slate-700/60 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Disparos no Mês</span>
              <span className="text-domu-blue">854 / 5.000</span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-domu-blue h-full w-[17%] rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded border border-slate-700/60 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Atendentes 1:1</span>
              <span className="text-emerald-400">4 / 10 Vagas</span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[40%] rounded-full"></div>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded border border-slate-700/60 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Coexistência Meta</span>
              <span className="text-emerald-400">Ativa (100% OK)</span>
            </div>
            <p className="text-[10.5px] text-slate-400">Zero risco de banimento de conta</p>
          </div>
        </div>
      </div>

      {/* SaaS Plans Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
          Planos Disponíveis para o Portal DOMU
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Plan 1: Starter */}
          <div className="bg-white rounded-md border border-slate-200/80 p-5 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Empresa Inicial</span>
                <h4 className="text-base font-black text-slate-900">Plano Starter</h4>
                <div className="mt-2">
                  <span className="text-2xl font-black text-slate-900">R$ 197</span>
                  <span className="text-xs text-slate-500"> / mês</span>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Até 1.000 disparos/mês</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>2 Atendentes no WhatsApp</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Meta Cloud API Oficial</span>
                </li>
              </ul>
            </div>

            <button className="w-full py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors">
              Fazer Downgrade
            </button>
          </div>

          {/* Plan 2: Pro (Current) */}
          <div className="bg-white rounded-md border-2 border-domu-blue p-5 space-y-4 shadow-md flex flex-col justify-between relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-domu-blue text-white text-[9.5px] font-black uppercase px-3 py-0.5 rounded-full shadow-xs">
              Recomendado • Seu Plano
            </span>

            <div className="space-y-3 pt-1">
              <div>
                <span className="text-[10px] font-bold text-domu-blue uppercase">Mais Popular</span>
                <h4 className="text-base font-black text-slate-900">Plano Pro</h4>
                <div className="mt-2">
                  <span className="text-2xl font-black text-slate-900">R$ 497</span>
                  <span className="text-xs text-slate-500"> / mês</span>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-slate-700 font-bold">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-domu-blue shrink-0" />
                  <span>Até 5.000 disparos/mês</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-domu-blue shrink-0" />
                  <span>Até 10 Atendentes 1:1</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-domu-blue shrink-0" />
                  <span>Coexistência Celular + Web</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-domu-blue shrink-0" />
                  <span>Suporte Prioritário DOMU</span>
                </li>
              </ul>
            </div>

            <button className="w-full py-2 rounded bg-domu-blue text-white text-xs font-bold shadow-sm cursor-default">
              Plano Atual Ativo
            </button>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="bg-white rounded-md border border-slate-200/80 p-5 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Grandes Agências</span>
                <h4 className="text-base font-black text-slate-900">Plano Enterprise</h4>
                <div className="mt-2">
                  <span className="text-2xl font-black text-slate-900">R$ 997</span>
                  <span className="text-xs text-slate-500"> / mês</span>
                </div>
              </div>

              <ul className="space-y-2 text-xs text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Disparos Ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Atendentes Ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Integrações com CRMs Personalizadas</span>
                </li>
              </ul>
            </div>

            <button className="btn-domu-primary text-xs py-2 justify-center">
              Fazer Upgrade para Enterprise
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
