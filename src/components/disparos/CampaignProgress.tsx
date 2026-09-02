'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Send,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Terminal,
  Calendar,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface CampaignProgressProps {
  campaignId: string;
  onClose?: () => void;
}

type ProgressData = {
  name: string;
  status: string;
  templateName: string | null;
  scheduledAt: string | null;
  totalLeads: number;
  waitingSchedule: boolean;
  progressPct: number;
  counts: {
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    sentTotal: number;
    deliveredTotal: number;
    readTotal: number;
  };
};

type LogRow = {
  id: string;
  status: string;
  statusLabel: string;
  errorMessage?: string | null;
  recipientName: string;
  recipientPhone: string;
  wamid?: string | null;
  createdAt?: string;
};

function badgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'READ' || s === 'DELIVERED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (s === 'SENT') return 'text-domu-blue bg-blue-50 border-blue-200';
  if (s === 'FAILED') return 'text-red-700 bg-red-50 border-red-200';
  if (s === 'PENDING') return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}

function headline(status: string, waiting: boolean): { label: string; className: string } {
  const s = status.toUpperCase();
  if (waiting || s === 'SCHEDULED') {
    return { label: 'Agendado', className: 'text-blue-600' };
  }
  if (s === 'RUNNING') return { label: 'Enviando', className: 'text-domu-blue' };
  if (s === 'FAILED') return { label: 'Falhou', className: 'text-red-600' };
  if (s === 'COMPLETED') return { label: 'Concluído', className: 'text-emerald-600' };
  return { label: s || 'Campanha', className: 'text-slate-700' };
}

export default function CampaignProgress({ campaignId, onClose }: CampaignProgressProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTechnicalLog, setShowTechnicalLog] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/progress`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar o progresso.');
        return;
      }
      setError(null);
      setData(json.campaign);
      setLogs(json.logs || []);
      return json.campaign as ProgressData;
    } catch (err) {
      console.error(err);
      setError('Falha ao atualizar progresso.');
      return null;
    }
  }, [campaignId]);

  const tryRunDue = useCallback(async () => {
    setTriggering(true);
    try {
      await fetch('/api/campaigns/run-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  }, [campaignId, load]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const camp = await load();
      if (cancelled || !camp) return;

      const status = String(camp.status || '').toUpperCase();
      const due =
        status === 'SCHEDULED' &&
        camp.scheduledAt &&
        new Date(camp.scheduledAt).getTime() <= Date.now();

      if (due || (status === 'RUNNING' && camp.counts.pending > 0)) {
        await fetch('/api/campaigns/run-due', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId }),
        });
        if (!cancelled) await load();
      }
    };

    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId, load]);

  const head = data
    ? headline(data.status, data.waitingSchedule)
    : { label: 'Carregando…', className: 'text-slate-500' };

  const total = data?.totalLeads || 0;
  const progressPct = data?.progressPct ?? 0;
  const counts = data?.counts;

  return (
    <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-blue-50 text-domu-blue flex items-center justify-center border border-blue-100 shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-black uppercase tracking-wider ${head.className}`}>
                {head.label}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Dados reais · campaign_logs + webhook Meta
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">
              {data?.name || 'Campanha'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data?.waitingSchedule && data.scheduledAt ? (
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(data.scheduledAt).toLocaleString('pt-BR')}
            </span>
          ) : null}
          {!data?.waitingSchedule &&
          String(data?.status || '').toUpperCase() === 'SCHEDULED' ? (
            <button
              type="button"
              onClick={tryRunDue}
              disabled={triggering}
              className="px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
              Disparar agora
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-600">Progresso do envio</span>
          <span className="text-domu-blue font-black">
            {(counts?.sentTotal || 0) + (counts?.failed || 0)} de {total} ({progressPct}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className="bg-domu-blue h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Enviados</span>
          <span className="text-lg font-black text-slate-900">{counts?.sentTotal ?? 0}</span>
        </div>
        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Entregues</span>
          <span className="text-lg font-black text-emerald-600">{counts?.deliveredTotal ?? 0}</span>
        </div>
        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Lidos</span>
          <span className="text-lg font-black text-domu-blue">{counts?.readTotal ?? 0}</span>
        </div>
        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Falhas</span>
          <span className="text-lg font-black text-red-600 flex items-center gap-1">
            {counts?.failed ?? 0}
            {(counts?.failed ?? 0) === 0 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            ) : null}
          </span>
        </div>
      </div>

      {data?.waitingSchedule ? (
        <p className="text-xs text-slate-500 leading-relaxed">
          A campanha está na fila. O envio começa automaticamente no horário agendado (cron ou
          enquanto esta tela estiver aberta).
        </p>
      ) : null}

      <div className="pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span className="flex items-center gap-1.5 text-slate-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Últimos envios
          </span>
          <button
            type="button"
            onClick={() => setShowTechnicalLog(!showTechnicalLog)}
            className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
          >
            <Terminal className="w-3 h-3" />
            <span>{showTechnicalLog ? 'Ocultar detalhes' : 'Exibir detalhes'}</span>
            {showTechnicalLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {logs.slice(0, 3).map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs gap-2"
            >
              <div className="truncate">
                <p className="font-bold text-slate-900 truncate">{log.recipientName}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{log.recipientPhone}</p>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeClass(log.status)}`}
              >
                {log.statusLabel}
              </span>
            </div>
          ))}
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 col-span-full">Nenhum log ainda.</p>
          ) : null}
        </div>
      </div>

      {showTechnicalLog ? (
        <div className="bg-slate-900 rounded p-3 border border-slate-800 text-slate-200 font-mono text-[11px] space-y-1 mt-3">
          <p className="text-[10px] text-emerald-400 font-bold uppercase pb-1 border-b border-slate-800">
            Logs da campanha
          </p>
          <div className="space-y-1 pt-1 max-h-36 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex justify-between gap-3 text-[10px] text-slate-300">
                <span className="truncate">
                  {log.recipientName} ({log.recipientPhone})
                  {log.wamid ? ` · ${log.wamid}` : ''}
                </span>
                <span
                  className={
                    log.status === 'FAILED' ? 'text-red-400 shrink-0' : 'text-emerald-400 shrink-0'
                  }
                >
                  {log.errorMessage || log.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
