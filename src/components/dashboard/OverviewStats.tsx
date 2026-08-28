'use client';

import React, { useState } from 'react';
import { Send, CheckCheck, MessageSquare, CalendarCheck, ShieldCheck, TrendingUp } from 'lucide-react';

export default function OverviewStats() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('30d');

  return (
    <div className="space-y-3">
      
      {/* Time Period Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
        <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          Métricas e Indicadores de Performance
        </h2>

        <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-md border border-slate-200/60 text-[11px] font-semibold text-slate-600">
          <span className="text-[10px] text-slate-400 font-medium px-1.5">Comparando:</span>
          
          <button
            onClick={() => setPeriod('today')}
            className={`px-2.5 py-0.5 rounded transition-all ${
              period === 'today' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Hoje
          </button>

          <button
            onClick={() => setPeriod('7d')}
            className={`px-2.5 py-0.5 rounded transition-all ${
              period === '7d' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Últimos 7 Dias
          </button>

          <button
            onClick={() => setPeriod('30d')}
            className={`px-2.5 py-0.5 rounded transition-all ${
              period === '30d' ? 'bg-domu-blue text-white font-bold shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Últimos 30 Dias
          </button>

          <button
            onClick={() => setPeriod('90d')}
            className={`px-2.5 py-0.5 rounded transition-all ${
              period === '90d' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            Últimos 90 Dias
          </button>
        </div>
      </div>

      {/* 5 Clean Metrics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Card 1: Total de Disparos */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-sm space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total de Disparos</span>
            <Send className="w-3.5 h-3.5 text-domu-blue" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">854</h3>
            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +24.0%
              </span>
              <span className="text-slate-400">vs anterior</span>
            </div>
          </div>
        </div>

        {/* Card 2: Taxa de Entrega */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-sm space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Taxa de Entrega</span>
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">98.4%</h3>
            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +1.2%
              </span>
              <span className="text-slate-400">• 840 entregues</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total de Conversas */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-sm space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Conversas</span>
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">558</h3>
            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +15.0%
              </span>
              <span className="text-slate-400">• Resposta 65%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Visitas Agendadas */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-sm space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Visitas Agendadas</span>
            <CalendarCheck className="w-3.5 h-3.5 text-domu-blue" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">42</h3>
            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +18.0%
              </span>
              <span className="text-slate-400">• Imóveis</span>
            </div>
          </div>
        </div>

        {/* Card 5: Quality Rating Meta */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-sm space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Conta Meta</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-emerald-600 tracking-tight leading-none mt-0.5">VERDE</h3>
            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                Coexistência OK
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
