'use client';

import React from 'react';
import { Search, Bell, PlusCircle, CheckCircle2, Phone } from 'lucide-react';
import { mockTenants } from '@/lib/mockData';

interface HeaderProps {
  onOpenNewDispatchModal?: () => void;
}

export default function Header({ onOpenNewDispatchModal }: HeaderProps) {
  const tenant = mockTenants[0];

  return (
    <header className="h-14 bg-white border-b border-slate-200 fixed top-0 right-0 left-64 z-30 px-6 flex items-center justify-between">
      {/* Title */}
      <div>
        <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Dashboard de Análise & Performance
        </h1>
        <p className="text-[11px] text-slate-500 font-medium">Métricas unificadas de disparos e atendimentos imobiliários</p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Connection Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1 text-[11px] font-semibold text-slate-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Meta Cloud API: <strong className="text-emerald-700 font-bold">Online</strong></span>
        </div>

        {/* Quick Action Button */}
        <button
          onClick={onOpenNewDispatchModal}
          className="btn-domu-primary text-xs shadow-sm py-1.5 px-3"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Novo Disparo</span>
        </button>

        {/* Notifications Bell */}
        <button className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 relative transition-colors shrink-0">
          <Bell className="w-4 h-4 text-slate-700" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-domu-blue text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
            1
          </span>
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-domu-blue text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
            AG
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-tight">Alan (Agência)</p>
            <p className="text-[10px] text-slate-500 font-medium">Gestor DOMU</p>
          </div>
        </div>
      </div>
    </header>
  );
}
