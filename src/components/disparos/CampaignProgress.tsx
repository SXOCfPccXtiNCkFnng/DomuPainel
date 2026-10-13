'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send,
  CheckCheck,
  Eye,
  XCircle,
  Calendar,
  X,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  Info,
  ExternalLink,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
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
  startedAt: string | null;
  completedAt: string | null;
  totalLeads: number;
  waitingSchedule: boolean;
  progressPct: number;
  missingRecipients: number;
  counts: {
    pending: number;
    sentTotal: number;
    deliveredTotal: number;
    readTotal: number;
    failed: number;
  };
};

type Recipient = {
  id: string;
  status: string;
  statusLabel: string;
  errorMessage?: string | null;
  name: string;
  phone: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt?: string;
};

type Filter = 'all' | 'sent' | 'delivered' | 'read' | 'failed' | 'pending';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'read', label: 'Lidos' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'sent', label: 'Só enviados' },
  { id: 'failed', label: 'Falhas' },
  { id: 'pending', label: 'Na fila' },
];

function badgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'READ') return 'text-domu-blue bg-blue-50 border-blue-200';
  if (s === 'DELIVERED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (s === 'SENT') return 'text-slate-700 bg-slate-50 border-slate-200';
  if (s === 'FAILED') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-amber-800 bg-amber-50 border-amber-200';
}

function headline(status: string, waiting: boolean): { label: string; className: string } {
  const s = status.toUpperCase();
  if (waiting || s === 'SCHEDULED') return { label: 'Agendada', className: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (s === 'RUNNING') return { label: 'Enviando', className: 'text-domu-blue bg-blue-50 border-blue-200' };
  if (s === 'FAILED') return { label: 'Falhou', className: 'text-red-700 bg-red-50 border-red-200' };
  if (s === 'COMPLETED') return { label: 'Concluída', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  return { label: s || 'Campanha', className: 'text-slate-600 bg-slate-50 border-slate-200' };
}

function formatPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone || '—';
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** O que aconteceu com esse envio, numa frase. */
function recipientDetail(r: Recipient): string {
  const s = r.status.toUpperCase();
  if (s === 'FAILED') return r.errorMessage || 'Falha sem detalhe da Meta.';
  if (s === 'READ') return `Lida em ${formatTime(r.readAt || r.deliveredAt || r.sentAt)}`;
  if (s === 'DELIVERED') return `Entregue em ${formatTime(r.deliveredAt || r.sentAt)}`;
  if (s === 'SENT') return `Enviada em ${formatTime(r.sentAt)} · aguardando entrega`;
  return 'Aguardando a vez de envio';
}

export default function CampaignProgress({ campaignId, onClose }: CampaignProgressProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [failureReasons, setFailureReasons] = useState<{ reason: string; count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  // O polling usa sempre os filtros atuais sem reiniciar o intervalo.
  const listRef = useRef({ filter, page, query });
  listRef.current = { filter, page, query };

  // Busca só depois de parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const { filter: f, page: p, query: q } = listRef.current;
      const params = new URLSearchParams({ status: f, page: String(p) });
      if (q) params.set('q', q);
      const res = await fetch(`/api/campaigns/${campaignId}/progress?${params}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar o progresso.');
        return null;
      }
      setError(null);
      setData(json.campaign);
      setRecipients(json.recipients || []);
      setRecipientsTotal(json.recipientsTotal || 0);
      setPageSize(json.pageSize || 50);
      setFailureReasons(json.failureReasons || []);
      return json.campaign as ProgressData;
    } catch (err) {
      console.error(err);
      setError('Falha ao atualizar o progresso.');
      return null;
    }
  }, [campaignId]);

  // Filtro, página ou busca mudou: recarrega a lista na hora.
  useEffect(() => {
    load();
  }, [filter, page, query, load]);

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
    // Um lote de envio pode levar ~40s; sem isso o intervalo de 4s empilha chamadas.
    let inFlight = false;

    const tick = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const camp = await load();
        if (cancelled || !camp) return;

        const status = String(camp.status || '').toUpperCase();
        const due = status === 'SCHEDULED' && camp.scheduledAt && new Date(camp.scheduledAt).getTime() <= Date.now();

        if (due || (status === 'RUNNING' && camp.counts.pending > 0)) {
          await fetch('/api/campaigns/run-due', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId }),
          });
          if (!cancelled) await load();
        }
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId, load]);

  const head = data ? headline(data.status, data.waitingSchedule) : { label: 'Carregando…', className: 'text-slate-500 bg-slate-50 border-slate-200' };
  const counts = data?.counts;
  const total = data?.totalLeads || 0;
  const processed = (counts?.sentTotal || 0) + (counts?.failed || 0);
  const totalPages = Math.max(1, Math.ceil(recipientsTotal / pageSize));

  // Aviso de cartão só faz sentido se já passou tempo para a Meta entregar.
  const sentLongAgo =
    data?.startedAt != null && Date.now() - new Date(data.startedAt).getTime() > 15 * 60 * 1000;
  const showPaymentHint = (counts?.sentTotal || 0) > 0 && (counts?.deliveredTotal || 0) === 0 && sentLongAgo;

  const selectFilter = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  const kpis: { id: Filter; label: string; value: number; icon: React.ReactNode; tone: string }[] = [
    { id: 'all', label: 'Enviados', value: counts?.sentTotal ?? 0, icon: <Send className="w-3.5 h-3.5" />, tone: 'text-slate-900' },
    { id: 'delivered', label: 'Entregues', value: counts?.deliveredTotal ?? 0, icon: <CheckCheck className="w-3.5 h-3.5" />, tone: 'text-emerald-600' },
    { id: 'read', label: 'Lidos', value: counts?.readTotal ?? 0, icon: <Eye className="w-3.5 h-3.5" />, tone: 'text-domu-blue' },
    { id: 'failed', label: 'Falhas', value: counts?.failed ?? 0, icon: <XCircle className="w-3.5 h-3.5" />, tone: (counts?.failed ?? 0) > 0 ? 'text-red-600' : 'text-slate-400' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-domu-blue flex items-center justify-center border border-blue-100 shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900">{data?.name || 'Campanha'}</h3>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${head.className}`}>{head.label}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {data?.templateName ? <>Template <span className="font-mono">{data.templateName}</span></> : null}
              {data?.startedAt ? ` · iniciada em ${formatTime(data.startedAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data?.waitingSchedule && data.scheduledAt ? (
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(data.scheduledAt).toLocaleString('pt-BR')}
            </span>
          ) : null}
          {!data?.waitingSchedule && String(data?.status || '').toUpperCase() === 'SCHEDULED' ? (
            <button
              type="button"
              onClick={tryRunDue}
              disabled={triggering}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
              Disparar agora
            </button>
          ) : null}
          {onClose ? (
            <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Progresso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">
            {processed} de {total} processados
            {(counts?.pending ?? 0) > 0 ? <span className="font-medium text-amber-700"> · {counts?.pending} na fila</span> : null}
          </span>
          <span className="font-black text-domu-blue">{data?.progressPct ?? 0}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div className="bg-domu-blue h-full transition-all duration-300 rounded-full" style={{ width: `${data?.progressPct ?? 0}%` }} />
        </div>
      </div>

      {/* Números — clicar filtra a lista */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => selectFilter(k.id)}
            aria-pressed={filter === k.id}
            className={`text-left p-3 rounded-xl border transition-colors ${
              filter === k.id ? 'border-domu-blue bg-blue-50/40' : 'border-slate-200/80 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              {k.icon}
              {k.label}
            </span>
            <span className={`text-xl font-black ${k.tone}`}>{k.value.toLocaleString('pt-BR')}</span>
          </button>
        ))}
      </div>

      {data?.waitingSchedule ? (
        <p className="text-xs text-slate-500">A campanha começa sozinha no horário agendado.</p>
      ) : null}

      {/* Por que falhou — agrupado pelo motivo */}
      {failureReasons.length > 0 ? (
        <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-1.5">
          <p className="text-xs font-bold text-red-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Por que algumas mensagens falharam
          </p>
          <ul className="space-y-1">
            {failureReasons.slice(0, 4).map((f) => (
              <li key={f.reason} className="text-[11.5px] text-red-800 flex gap-2">
                <span className="font-bold shrink-0">{f.count}×</span>
                <span>{f.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showPaymentHint ? (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Enviadas, mas ainda não entregues?</p>
            <p className="text-[11px] text-amber-800">
              Para entregar mensagens de marketing, a Meta exige um cartão de crédito cadastrado na sua conta do WhatsApp
              Business.
            </p>
            <a
              href="https://business.facebook.com/latest/whatsapp_manager/overview/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold underline text-[11px]"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Ver pagamentos na Meta
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : null}

      {/* Destinatários */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-domu-blue" />
            Destinatários
            <span className="font-medium text-slate-500">({recipientsTotal.toLocaleString('pt-BR')})</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por situação">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou telefone"
                aria-label="Buscar destinatário"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-domu-blue/30"
              />
            </div>
          </div>
        </div>

        {recipients.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
            {filter === 'all' && !query ? 'Nenhum destinatário ainda.' : 'Ninguém nesse filtro.'}
          </p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left font-bold px-3 py-2">Contato</th>
                    <th className="text-left font-bold px-3 py-2">Situação</th>
                    <th className="text-left font-bold px-3 py-2">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-900">{r.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{formatPhone(r.phone)}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${badgeClass(r.status)}`}>
                          {r.statusLabel}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-[11px] ${r.status === 'FAILED' ? 'text-red-700' : 'text-slate-600'}`}>
                        {recipientDetail(r)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600">
                <span>
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {data && data.missingRecipients > 0 ? (
          <p className="text-[11px] text-slate-500">
            {data.missingRecipients} envio(s) desta campanha eram de contatos excluídos antes de o histórico passar a ser
            guardado — eles contam nos números acima, mas não aparecem na lista.
          </p>
        ) : null}
      </div>
    </div>
  );
}
