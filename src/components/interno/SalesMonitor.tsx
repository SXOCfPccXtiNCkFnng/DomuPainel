'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MessageCircle, Pause, Play, Power, RefreshCw, Search } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatPhoneBR } from '@/lib/validators';
import {
  SALES_SKIP_LABELS,
  SALES_STAGE_LABELS,
  SALES_STAGES,
  type SalesConversation,
  type SalesStage,
  type SalesWho,
} from '@/lib/salesMonitorRules';

type MonitorData =
  | { configured: false }
  | {
      configured: true;
      enabled: boolean;
      days: number;
      conversations: SalesConversation[];
      funnel: Record<SalesStage, number>;
      unapproached: number;
    };

type Chat = {
  messages: { who: SalesWho; text: string; at: string }[];
  runs: { status: string; reason: string | null; tools: string[]; at: string }[];
};

type Filter = 'all' | 'needsYou' | 'interested' | 'noReply' | 'clients' | 'unapproached';

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

const STAGE_TONE: Record<SalesStage, string> = {
  ABORDADO: 'bg-slate-100 text-slate-600 border-slate-200',
  RESPONDEU: 'bg-sky-50 text-sky-700 border-sky-200',
  INTERESSADO: 'bg-amber-50 text-amber-800 border-amber-200',
  CONTA: 'bg-violet-50 text-violet-700 border-violet-200',
  TESTE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CLIENTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const WHO_LABEL: Record<SalesWho, string> = { VOCE: 'Você', VENDEDORA: 'Vendedora', CLIENTE: 'Cliente' };

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)} dias`;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function waLink(phone: string): string {
  return `https://wa.me/${String(phone).replace(/\D/g, '')}`;
}

function ChatView({ leadId }: { leadId: string }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/interno/sales?leadId=${leadId}`)
      .then((r) => r.json())
      .then((json) => (json.success ? setChat(json.chat) : setError(json.error || 'Não foi possível abrir.')))
      .catch(() => setError('Não foi possível abrir a conversa.'));
  }, [leadId]);

  if (error) return <p className="text-xs text-red-600 px-4 pb-4">{error}</p>;
  if (!chat) {
    return (
      <p className="text-xs text-slate-500 px-4 pb-4 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Abrindo conversa...
      </p>
    );
  }

  // Mensagens e os "não respondeu" da vendedora na ordem do tempo.
  const items = [
    ...chat.messages.map((m) => ({ kind: 'msg' as const, at: m.at, m })),
    ...chat.runs
      .filter((r) => r.status !== 'REPLIED' && r.status !== 'SUPERSEDED')
      .map((r) => ({ kind: 'skip' as const, at: r.at, r })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="mx-4 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 max-h-[28rem] overflow-y-auto">
      {items.map((item, i) =>
        item.kind === 'msg' ? (
          <div key={i} className={`flex ${item.m.who === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                item.m.who === 'CLIENTE'
                  ? 'bg-white border border-slate-200 text-slate-800'
                  : item.m.who === 'VENDEDORA'
                    ? 'bg-domu-blue text-white'
                    : 'bg-emerald-600 text-white'
              }`}
            >
              <p className="text-[10px] font-bold opacity-70 mb-0.5">
                {WHO_LABEL[item.m.who]} · {clock(item.m.at)}
              </p>
              {item.m.text}
            </div>
          </div>
        ) : (
          <p key={i} className="text-center text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
            {clock(item.at)} · não respondeu: {(item.r.reason && SALES_SKIP_LABELS[item.r.reason]) || item.r.reason || item.r.status}
          </p>
        )
      )}
      {!items.length && <p className="text-xs text-slate-500">Sem mensagens.</p>}
    </div>
  );
}

export default function SalesMonitor() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setData(null);
      try {
        const res = await fetch(`/api/interno/sales?days=${days}`);
        const json = await res.json();
        if (!json.success) {
          setError(json.error || 'Não foi possível carregar.');
          return;
        }
        setData(json as MonitorData);
        setError(null);
      } catch {
        setError('Não foi possível carregar as conversas.');
      }
    },
    [days]
  );

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(() => load(true));

  const act = async (leadId: string, action: 'pause' | 'resume' | 'disable' | 'enable') => {
    setBusy(`${leadId}:${action}`);
    try {
      const res = await fetch('/api/interno/sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) setError(json.error || 'Não foi possível aplicar.');
      await load(true);
    } finally {
      setBusy(null);
    }
  };

  const toggleAgent = async () => {
    if (!data?.configured) return;
    setBusy('agent');
    try {
      const res = await fetch('/api/interno/test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_sales_agent', enabled: !data.enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) setError(json.error || 'Não foi possível aplicar.');
      await load(true);
    } finally {
      setBusy(null);
    }
  };

  const list = useMemo(() => {
    if (!data?.configured) return [];
    const term = q.trim().toLowerCase();
    return data.conversations.filter((c) => {
      if (filter === 'unapproached' ? c.approached : !c.approached) return false;
      if (filter === 'needsYou' && !c.needsYou) return false;
      if (filter === 'interested' && c.stage !== 'INTERESSADO') return false;
      if (filter === 'noReply' && c.stage !== 'ABORDADO') return false;
      if (filter === 'clients' && !['CONTA', 'TESTE', 'CLIENTE'].includes(c.stage)) return false;
      if (!term) return true;
      return [c.name, c.phone, c.business?.kind, c.business?.city, c.last.text].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [data, filter, q]);

  if (error && !data) return <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>;
  if (!data) {
    return (
      <p className="text-xs text-slate-500 flex items-center gap-2 p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando conversas da vendedora...
      </p>
    );
  }
  if (!data.configured) {
    return (
      <section className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
        <h2 className="text-sm font-black text-slate-900">Vendedora não configurada</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Coloque o ID da conta de vendas em DOMU_SALES_TENANT_ID na Vercel e faça o deploy. As conversas dela aparecem aqui.
        </p>
      </section>
    );
  }

  const approachedTotal = data.funnel.ABORDADO;
  const needsYou = data.conversations.filter((c) => c.approached && c.needsYou).length;
  const interested = data.conversations.filter((c) => c.approached && c.stage === 'INTERESSADO').length;
  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'needsYou', label: 'Precisam de você', count: needsYou },
    { id: 'interested', label: 'Interessados', count: interested },
    { id: 'noReply', label: 'Ainda não responderam' },
    { id: 'clients', label: 'Criaram conta' },
    { id: 'unapproached', label: 'Escreveram sem abordagem', count: data.unapproached },
  ];

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${data.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <div>
            <p className="text-sm font-black text-slate-900">Vendedora {data.enabled ? 'ligada' : 'desligada'}</p>
            <p className="text-[11px] text-slate-500">
              {data.enabled ? 'Responde quem você abordou pelo número de vendas.' : 'Ninguém recebe resposta dela até você ligar de novo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAgent}
            disabled={busy !== null}
            className="ml-2 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy === 'agent' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            {data.enabled ? 'Desligar' : 'Ligar'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                days === p.days ? 'bg-domu-blue text-white border-domu-blue' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => load(true)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {SALES_STAGES.map((stage) => {
          const count = data.funnel[stage];
          const pct = approachedTotal && stage !== 'ABORDADO' ? Math.round((count / approachedTotal) * 100) : null;
          return (
            <div key={stage} className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{SALES_STAGE_LABELS[stage]}</p>
              <p className="text-xl font-black text-slate-900">{count}</p>
              <p className="text-[10.5px] text-slate-400">{pct == null ? 'conversas abordadas' : `${pct}% dos abordados`}</p>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
                {f.count ? (
                  <span className={`ml-1.5 px-1.5 rounded-full text-[10px] ${f.id === 'needsYou' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {f.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, telefone, ramo ou cidade"
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-domu-blue"
            />
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-xs text-slate-500 p-6 text-center">
            {filter === 'all' ? 'Nenhuma conversa de venda no período. Aborde pelo botão de WhatsApp da Prospecção.' : 'Nada nesse filtro.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((c) => (
              <li key={c.leadId}>
                <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setOpen(open === c.leadId ? null : c.leadId)} className="text-left flex-1 min-w-[240px] space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900">{c.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STAGE_TONE[c.stage]}`}>{SALES_STAGE_LABELS[c.stage]}</span>
                      {c.needsYou && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">Precisa de você</span>}
                      {c.ai === 'PAUSADA' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">
                          Pausada{c.pausedUntil ? ` até ${clock(c.pausedUntil)}` : ''}
                        </span>
                      )}
                      {c.ai === 'DESLIGADA' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">Desligada neste contato</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {[c.business?.kind, c.business?.city, formatPhoneBR(c.phone) || c.phone].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-slate-700 line-clamp-1">
                      <span className="font-bold">{WHO_LABEL[c.last.who]}:</span> {c.last.text || '(mídia)'}{' '}
                      <span className="text-slate-400">· {ago(c.lastAt)}</span>
                    </p>
                    {c.lastSkip && <p className="text-[11px] text-amber-700">Não respondeu: {c.lastSkip.label}</p>}
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={waLink(c.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                    {c.ai === 'PAUSADA' ? (
                      <button
                        type="button"
                        onClick={() => act(c.leadId, 'resume')}
                        disabled={busy !== null}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" /> Devolver para a vendedora
                      </button>
                    ) : c.ai === 'ATENDENDO' ? (
                      <button
                        type="button"
                        onClick={() => act(c.leadId, 'pause')}
                        disabled={busy !== null}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pausar 12h
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => act(c.leadId, c.ai === 'DESLIGADA' ? 'enable' : 'disable')}
                      disabled={busy !== null}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {c.ai === 'DESLIGADA' ? 'Ligar neste contato' : 'Desligar neste contato'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(open === c.leadId ? null : c.leadId)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50"
                      aria-label={open === c.leadId ? 'Fechar conversa' : 'Ver conversa'}
                    >
                      {open === c.leadId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {open === c.leadId && <ChatView leadId={c.leadId} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
