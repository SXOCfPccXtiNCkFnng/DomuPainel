'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCheck,
  MessageSquare,
  Users,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { getAuthItem } from '@/lib/authStorage';

type Period = 'today' | '7d' | '30d' | '90d';

interface DashboardMetrics {
  totalDispatches: number;
  deliveryRate: string;
  totalLeads: number;
  readCount: number;
  whatsappStatus?: string;
  trends?: {
    dispatches: number | null;
    deliveryRate: number | null;
    conversations: number | null;
    contacts: number | null;
  };
}

function TrendBadge({
  value,
  suffix = 'vs anterior',
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-1 mt-1 text-[10.5px]">
        <span className="font-bold text-slate-400 flex items-center gap-0.5">
          <Minus className="w-3 h-3" /> —
        </span>
        <span className="text-slate-400">{suffix}</span>
      </div>
    );
  }

  const isUp = value > 0;
  const isFlat = value === 0;
  const color = isFlat
    ? 'text-slate-500'
    : isUp
      ? 'text-emerald-600'
      : 'text-red-600';
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const sign = value > 0 ? '+' : '';

  return (
    <div className="flex items-center gap-1 mt-1 text-[10.5px]">
      <span className={`font-bold flex items-center gap-0.5 ${color}`}>
        <Icon className="w-3 h-3" />
        {sign}
        {value.toFixed(1)}%
      </span>
      <span className="text-slate-400">{suffix}</span>
    </div>
  );
}

export default function OverviewStats() {
  const [period, setPeriod] = useState<Period>('30d');
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalDispatches: 0,
    deliveryRate: '0.0%',
    totalLeads: 0,
    readCount: 0,
    trends: {
      dispatches: null,
      deliveryRate: null,
      conversations: null,
      contacts: null,
    },
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(
        `/api/dashboard/stats?tenantId=${storedTenantId}&period=${period}`
      );
      const data = await res.json();

      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Erro ao buscar métricas do Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const periods: { id: Period; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: '7d', label: 'Últimos 7 Dias' },
    { id: '30d', label: 'Últimos 30 Dias' },
    { id: '90d', label: 'Últimos 90 Dias' },
  ];

  const metaOk =
    !metrics.whatsappStatus ||
    metrics.whatsappStatus === 'CONNECTED' ||
    metrics.whatsappStatus === 'ACTIVE';

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
        <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">
          Métricas e Indicadores de Performance
          {isLoading ? (
            <span className="ml-2 text-[10px] font-medium text-slate-400 normal-case">
              atualizando…
            </span>
          ) : null}
        </h2>

        <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-md border border-slate-200/60 text-[11px] font-semibold text-slate-600">
          <span className="text-[10px] text-slate-400 font-medium px-1.5">Comparando:</span>
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                period === p.id
                  ? 'bg-domu-blue text-white font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-xs space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total de Disparos</span>
            <Send className="w-3.5 h-3.5 text-domu-blue" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">
              {metrics.totalDispatches}
            </h3>
            <TrendBadge value={metrics.trends?.dispatches} />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-xs space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Taxa de Entrega</span>
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">
              {metrics.deliveryRate}
            </h3>
            <TrendBadge value={metrics.trends?.deliveryRate} suffix="• Entregues" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-xs space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Conversas</span>
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">
              {metrics.readCount}
            </h3>
            <TrendBadge value={metrics.trends?.conversations} suffix="• Leituras" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-xs space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total de Contatos</span>
            <Users className="w-3.5 h-3.5 text-domu-blue" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mt-0.5">
              {metrics.totalLeads}
            </h3>
            <TrendBadge value={metrics.trends?.contacts} suffix="• Novos no período" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-md border border-slate-200/80 shadow-xs space-y-1.5 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Conta Meta</span>
            <ShieldCheck
              className={`w-3.5 h-3.5 ${metaOk ? 'text-emerald-500' : 'text-amber-500'}`}
            />
          </div>
          <div>
            <h3
              className={`text-xl font-black tracking-tight leading-none mt-0.5 ${
                metaOk ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {metaOk ? 'VERDE' : 'ATENÇÃO'}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
              <span
                className={`font-bold px-1.5 py-0.2 rounded border ${
                  metaOk
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}
              >
                {metaOk ? 'Coexistência OK' : 'Revisar conexão'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
