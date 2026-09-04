'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  MessageSquareReply,
  UserCheck,
  CalendarCheck,
  TrendingUp,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  Send,
  CheckCheck,
  Users,
  AlertCircle,
} from 'lucide-react';
import { getAuthItem } from '@/lib/authStorage';
import { getSegmentFromStorage, isDispatchOnlySegment } from '@/lib/segmentConfig';

interface RoiMetrics {
  atingidos: number;
  taxaResposta: number;
  respostasReais: number;
  leadsQualificados: number;
  visitasAgendadas: number;
  totalDisparos: number;
  baseContatos: number;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function MetricasRoiPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<RoiMetrics>({
    atingidos: 0,
    taxaResposta: 0,
    respostasReais: 0,
    leadsQualificados: 0,
    visitasAgendadas: 0,
    totalDisparos: 0,
    baseContatos: 0,
  });

  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError('');
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      const since = daysAgo(days).toISOString();

      const res = await fetch(
        `/api/dashboard/stats?tenantId=${tenantId}&period=${period}`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar as métricas.');
        return;
      }
      const m = json.metrics || {};

      // Respostas reais = mensagens INBOUND no período
      const repliesRes = await fetch(
        `/api/reports/replies?tenantId=${tenantId}&since=${encodeURIComponent(since)}`
      );
      const repliesJson = await repliesRes.json().catch(() => ({ count: 0 }));
      const respostasReais = repliesJson.count ?? 0;

      const totalDisparos = m.totalDispatches || 0;
      const taxaResposta =
        totalDisparos > 0
          ? Math.round((respostasReais / totalDisparos) * 1000) / 10
          : m.taxaResposta || 0;

      setMetrics({
        atingidos: m.atingidos ?? 0,
        taxaResposta,
        respostasReais,
        leadsQualificados: m.leadsQualificados ?? 0,
        visitasAgendadas: m.visitasAgendadas ?? 0,
        totalDisparos,
        baseContatos: m.totalLeads ?? 0,
      });
    } catch (err) {
      console.error('Erro ao carregar métricas de ROI:', err);
      setError('Falha de conexão ao carregar as métricas. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const cards = isDispatchOnlySegment(getSegmentFromStorage())
    ? [
        {
          title: 'Total de disparos',
          value: metrics.totalDisparos.toLocaleString('pt-BR'),
          hint: 'Envios no período',
          icon: Send,
          tone: 'text-domu-blue bg-blue-50 border-blue-100',
        },
        {
          title: 'Atingidos',
          value: metrics.atingidos.toLocaleString('pt-BR'),
          hint: 'Entregas confirmadas',
          icon: CheckCheck,
          tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        },
        {
          title: 'Respostas',
          value: metrics.respostasReais.toLocaleString('pt-BR'),
          hint: `Taxa ${metrics.taxaResposta}% · inbound`,
          icon: MessageSquareReply,
          tone: 'text-amber-700 bg-amber-50 border-amber-100',
        },
        {
          title: 'Base de contatos',
          value: metrics.baseContatos.toLocaleString('pt-BR'),
          hint: 'Lista disponível para campanhas',
          icon: Users,
          tone: 'text-violet-700 bg-violet-50 border-violet-100',
        },
      ]
    : [
        {
          title: 'Atingidos',
          value: metrics.atingidos.toLocaleString('pt-BR'),
          hint: 'Entregas confirmadas no período',
          icon: Target,
          tone: 'text-domu-blue bg-blue-50 border-blue-100',
        },
        {
          title: 'Respostas reais',
          value: metrics.respostasReais.toLocaleString('pt-BR'),
          hint: `Taxa ${metrics.taxaResposta}% · WhatsApp inbound`,
          icon: MessageSquareReply,
          tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        },
        {
          title: 'Leads qualificados',
          value: metrics.leadsQualificados.toLocaleString('pt-BR'),
          hint: 'Contatos em funil ativo',
          icon: UserCheck,
          tone: 'text-amber-700 bg-amber-50 border-amber-100',
        },
        {
          title: 'Visitas agendadas',
          value: metrics.visitasAgendadas.toLocaleString('pt-BR'),
          hint: 'Status visita no CRM',
          icon: CalendarCheck,
          tone: 'text-violet-700 bg-violet-50 border-violet-100',
        },
      ];

  const dispatchOnly = isDispatchOnlySegment(getSegmentFromStorage());

  return (
    <div className="space-y-6 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              {dispatchOnly ? 'Campanhas' : 'ROI Comercial'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {dispatchOnly
                ? 'Performance de disparos no WhatsApp'
                : 'Respostas do WhatsApp + visitas do funil'}
            </span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            {dispatchOnly ? 'Métricas de Campanha' : 'Métricas de ROI'}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p
                    ? 'bg-white text-domu-blue shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : '90 Dias'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={fetchMetrics}
            className="px-3 py-2 text-xs font-bold text-domu-blue hover:bg-blue-50 rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <Link
            href="/relatorios"
            className="px-3.5 py-2 bg-white text-slate-700 font-extrabold border border-slate-300 rounded-xl text-xs hover:bg-slate-50 flex items-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4 text-domu-blue" />
            Ver Relatórios
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {card.title}
                </p>
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center ${card.tone}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {isLoading ? '—' : card.value}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">{card.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-domu-blue" />
          <h3 className="text-sm font-black text-slate-900">Como ler este painel</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          <strong>Respostas reais</strong> vêm das mensagens inbound do webhook Meta (cliente
          respondeu no WhatsApp). <strong>Visitas agendadas</strong> vêm do status do contato no
          funil (edite em Contatos). Volume técnico de entrega Meta:{' '}
          <Link href="/relatorios" className="text-domu-blue font-bold hover:underline">
            Relatórios de Análise
          </Link>
          . Base: <strong>{metrics.baseContatos}</strong> contatos ·{' '}
          <strong>{metrics.totalDisparos}</strong> disparos no período.
        </p>
      </div>
    </div>
  );
}
