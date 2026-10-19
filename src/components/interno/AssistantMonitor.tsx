'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, CheckCircle2, MessageSquareText, RefreshCw, Search, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import type { AssistantMetrics, AssistantRunView, ConversationMessage } from '@/lib/assistantMetrics';
import { brtDate, FLAG_LABELS, type AssistantFlag, type AssistantRunStatus } from '@/lib/assistantUsage';

const STATUS_LABEL: Record<AssistantRunStatus, { text: string; className: string }> = {
  REPLIED: { text: 'Respondeu', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SKIPPED: { text: 'Não respondeu (regra)', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  NO_REPLY: { text: 'IA sem resposta', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  FAILED: { text: 'Falhou', className: 'bg-red-50 text-red-700 border-red-200' },
  SUPERSEDED: { text: 'Trocada por msg nova', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const REASON_LABEL: Record<string, string> = {
  PAUSED_BY_HANDOFF: 'Pausada (equipe chamada ou limite)',
  HUMAN_REPLIED: 'Equipe já estava respondendo',
  RATE_LIMIT: 'Bateu o limite por hora',
  OPT_OUT: 'Cliente pediu para parar',
  IA_SEM_RESPOSTA: 'IA não devolveu texto',
  WHATSAPP_INDISPONIVEL: 'WhatsApp desconectado',
  ENVIO_FALHOU: 'Meta recusou o envio',
  ERRO_INTERNO: 'Erro no sistema',
  MENSAGEM_NOVA: 'Cliente mandou outra mensagem',
  SEM_CHAVE_IA: 'Chave da IA não configurada',
  COTA_ESGOTADA: 'Cota do mês esgotada',
};

const TOOL_LABEL: Record<string, string> = {
  consultar_horarios_livres: 'Consultou horários',
  agendar: 'Agendou',
  ver_agendamentos_do_cliente: 'Viu agendamentos',
  cancelar_agendamento: 'Cancelou agendamento',
  chamar_equipe: 'Chamou a equipe',
};

const FLAG_TONE: Record<AssistantFlag, string> = {
  VALOR_NAO_CADASTRADO: 'bg-red-50 text-red-700 border-red-200',
  HORARIO_SEM_AGENDA: 'bg-amber-50 text-amber-800 border-amber-200',
  NAO_SABIA: 'bg-sky-50 text-sky-700 border-sky-200',
  CHAMOU_EQUIPE: 'bg-violet-50 text-violet-700 border-violet-200',
  ERRO_FERRAMENTA: 'bg-red-50 text-red-700 border-red-200',
};

const FLAG_HINT: Record<AssistantFlag, string> = {
  VALOR_NAO_CADASTRADO: 'Citou um R$ que não está nos serviços nem nas regras. Pode ser conta certa (ex.: soma de acréscimo) ou alucinação.',
  HORARIO_SEM_AGENDA: 'Ofereceu horários sem consultar a agenda nesta resposta. Pode ter repetido os de antes ou inventado.',
  NAO_SABIA: 'Disse que não tinha a informação. Bom sinal de dado faltando no cadastro da loja.',
  CHAMOU_EQUIPE: 'Passou a conversa para uma pessoa.',
  ERRO_FERRAMENTA: 'A agenda devolveu erro para a IA.',
};

const PERIODS = [
  { days: 1, label: 'Hoje' },
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

function money(brl: number): string {
  return brl.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: brl > 0 && brl < 1 ? 3 : 2,
  });
}

const usd = (n: number) => `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`;
const int = (n: number) => Math.round(n).toLocaleString('pt-BR');
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '—');

function seconds(ms: number | null): string {
  if (ms == null) return '—';
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 60_000)} min`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Mesmo critério do filtro "Precisa de atenção" da API. */
function needsAttention(run: AssistantRunView): boolean {
  if (run.status === 'FAILED' || run.status === 'NO_REPLY' || run.reviewStatus === 'BAD') return true;
  return run.reviewStatus == null && run.flags.some((f) => f !== 'CHAMOU_EQUIPE');
}

function Kpi({ label, value, hint, tone = 'slate' }: { label: string; value: string; hint?: string; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const color = { slate: 'text-slate-900', green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', blue: 'text-domu-blue' }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
        active ? 'bg-domu-blue text-white border-domu-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

export default function AssistantMonitor() {
  const [days, setDays] = useState(30);
  const [tenantId, setTenantId] = useState('');
  const [metrics, setMetrics] = useState<AssistantMetrics | null>(null);
  const [missingTable, setMissingTable] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [runs, setRuns] = useState<AssistantRunView[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [attention, setAttention] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<AssistantRunStatus | ''>('');
  const [flagFilter, setFlagFilter] = useState<AssistantFlag | ''>('');
  const [reviewFilter, setReviewFilter] = useState<'' | 'PENDING' | 'OK' | 'BAD'>('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const [conversation, setConversation] = useState<{ tenantId: string; leadId: string; title: string } | null>(null);
  const [conversationData, setConversationData] = useState<{ messages: ConversationMessage[]; runs: AssistantRunView[] } | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ view: 'metrics', days: String(days) });
      if (tenantId) params.set('tenantId', tenantId);
      const res = await fetch(`/api/interno/assistant?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar as métricas.');
        return;
      }
      if (json.missingTable) {
        setMissingTable(json.message);
        setMetrics(null);
        return;
      }
      setMissingTable('');
      setMetrics(json.metrics);
    } catch {
      setError('Erro de conexão ao carregar as métricas.');
    } finally {
      setLoading(false);
    }
  }, [days, tenantId]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const params = new URLSearchParams({ view: 'runs', days: String(days) });
      if (tenantId) params.set('tenantId', tenantId);
      if (statusFilter) params.set('status', statusFilter);
      if (flagFilter) params.set('flag', flagFilter);
      if (reviewFilter) params.set('review', reviewFilter);
      if (searchApplied) params.set('q', searchApplied);
      if (attention) params.set('attention', '1');
      const res = await fetch(`/api/interno/assistant?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setRuns(json.runs || []);
    } finally {
      setRunsLoading(false);
    }
  }, [days, tenantId, statusFilter, flagFilter, reviewFilter, searchApplied, attention]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!conversation) {
      setConversationData(null);
      return;
    }
    const params = new URLSearchParams({ view: 'conversation', tenantId: conversation.tenantId, leadId: conversation.leadId });
    fetch(`/api/interno/assistant?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setConversationData({ messages: json.messages || [], runs: json.runs || [] });
      })
      .catch(() => setConversationData({ messages: [], runs: [] }));
  }, [conversation]);

  async function review(run: AssistantRunView, value: 'OK' | 'BAD' | null) {
    let note: string | null = run.reviewNote;
    if (value === 'BAD') {
      const typed = window.prompt('O que estava errado nessa resposta? (opcional)', run.reviewNote || '');
      if (typed === null) return;
      note = typed;
    }
    const res = await fetch('/api/interno/assistant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: run.id, review: value, note }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      setRuns((list) => list.map((r) => (r.id === run.id ? { ...r, reviewStatus: value, reviewNote: value ? note : null } : r)));
      loadMetrics();
    }
  }

  const rate = metrics?.usdBrl || 5.5;
  const t = metrics?.totals;
  const attempts = t ? t.replied + t.noReply + t.failed : 0;
  const maxDayCost = useMemo(() => Math.max(0.000001, ...(metrics?.daily || []).map((d) => d.costUsdFull)), [metrics]);
  const maxDayRuns = useMemo(() => Math.max(1, ...(metrics?.daily || []).map((d) => d.replied)), [metrics]);

  const groups = useMemo(() => {
    const map = new Map<string, AssistantRunView[]>();
    for (const r of runs) {
      const key = r.leadId ? `${r.tenantId}:${r.leadId}:${brtDate(r.createdAt)}` : r.id;
      map.set(key, [...(map.get(key) || []), r]);
    }
    return [...map.entries()].map(([key, list]) => ({
      key,
      runs: [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }));
  }, [runs]);

  const openConversation = (run: AssistantRunView) =>
    run.leadId &&
    setConversation({ tenantId: run.tenantId, leadId: run.leadId, title: `${run.leadName || run.leadPhone || 'Contato'} · ${run.tenantName}` });

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function renderRun(run: AssistantRunView, standalone: boolean) {
    return (
      <div
        key={run.id}
        className={`space-y-2 ${standalone ? 'p-4' : 'py-2'} ${run.reviewStatus === 'BAD' ? 'bg-red-50/40' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">{standalone ? when(run.createdAt) : time(run.createdAt)}</span>
          {standalone ? (
            <>
              <span className="font-bold text-slate-900">{run.tenantName}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{run.leadName || run.leadPhone || 'Contato'}</span>
            </>
          ) : null}
          <span className={`font-bold px-1.5 py-px rounded border ${STATUS_LABEL[run.status].className}`}>{STATUS_LABEL[run.status].text}</span>
          {run.reason ? <span className="text-slate-500">({REASON_LABEL[run.reason] || run.reason})</span> : null}
          {run.flags.map((f) => (
            <span key={f} title={FLAG_HINT[f]} className={`font-bold px-1.5 py-px rounded border ${FLAG_TONE[f]}`}>
              {FLAG_LABELS[f]}
            </span>
          ))}
          {run.booked ? <span className="font-bold px-1.5 py-px rounded border bg-emerald-50 text-emerald-700 border-emerald-200">Agendou</span> : null}
          {run.reviewStatus === 'OK' ? (
            <span className="font-bold text-emerald-600 inline-flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Certa
            </span>
          ) : null}
          {run.reviewStatus === 'BAD' ? <span className="font-bold text-red-600">Errada{run.reviewNote ? `: ${run.reviewNote}` : ''}</span> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">Cliente</p>
            <p className="text-xs text-slate-800 whitespace-pre-wrap">{run.customerMessage || '—'}</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-domu-blue mb-0.5 inline-flex items-center gap-1">
              <Bot className="w-3 h-3" /> Atendente{run.status !== 'REPLIED' && run.replyText ? ' (não enviada)' : ''}
            </p>
            <p className="text-xs text-slate-800 whitespace-pre-wrap">{run.replyText || run.error || '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
          {run.tools.length ? <span>{run.tools.map((n) => TOOL_LABEL[n] || n).join(' → ')}</span> : null}
          {run.aiCalls ? <span>{run.aiCalls} chamada(s) à IA</span> : null}
          {run.inputTokens || run.outputTokens ? (
            <span>
              {int(run.inputTokens)} + {int(run.outputTokens)} tokens
            </span>
          ) : null}
          {run.costUsdFull ? <span>{money(run.costUsdFull * rate)}</span> : null}
          {run.aiMs != null ? <span>IA {seconds(run.aiMs)}</span> : null}
          {run.responseMs != null ? <span>respondeu em {seconds(run.responseMs)}</span> : null}
          <span className="ml-auto flex items-center gap-1">
            {standalone && run.leadId ? (
              <button
                type="button"
                onClick={() => openConversation(run)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-600 font-bold hover:border-domu-blue/40"
              >
                <MessageSquareText className="w-3 h-3" /> Ver conversa
              </button>
            ) : null}
            {run.replyText ? (
              <>
                <button
                  type="button"
                  onClick={() => review(run, run.reviewStatus === 'OK' ? null : 'OK')}
                  title="Resposta certa"
                  className={`p-1 rounded-md border ${
                    run.reviewStatus === 'OK' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => review(run, run.reviewStatus === 'BAD' ? null : 'BAD')}
                  title="Resposta errada (alucinou, não respondeu o que devia...)"
                  className={`p-1 rounded-md border ${
                    run.reviewStatus === 'BAD' ? 'bg-red-600 text-white border-red-600' : 'border-slate-200 text-slate-500 hover:text-red-600'
                  }`}
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </>
            ) : null}
          </span>
        </div>
      </div>
    );
  }

  function renderGroup(group: { key: string; runs: AssistantRunView[] }) {
    const first = group.runs[0];
    const last = group.runs[group.runs.length - 1];
    const problems = group.runs.filter(needsAttention);
    const isOpen = expanded.has(group.key);
    const visible = isOpen ? group.runs : problems.length ? problems : [last];
    const flags = [...new Set(group.runs.flatMap((r) => r.flags))];
    const cost = group.runs.reduce((s, r) => s + r.costUsdFull, 0);
    const replied = group.runs.filter((r) => r.status === 'REPLIED').length;
    return (
      <div key={group.key} className={`p-4 space-y-2 ${problems.length ? 'border-l-4 border-l-amber-400' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">
            {when(first.createdAt)}
            {group.runs.length > 1 ? ` – ${time(last.createdAt)}` : ''}
          </span>
          <span className="font-bold text-slate-900">{first.tenantName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{first.leadName || first.leadPhone || 'Contato'}</span>
          <span className="font-bold px-1.5 py-px rounded border bg-slate-50 text-slate-600 border-slate-200">
            {replied} resposta{replied === 1 ? '' : 's'}
          </span>
          {problems.length ? (
            <span className="font-bold px-1.5 py-px rounded border bg-amber-50 text-amber-800 border-amber-200">
              {problems.length} para conferir
            </span>
          ) : null}
          {group.runs.some((r) => r.booked) ? (
            <span className="font-bold px-1.5 py-px rounded border bg-emerald-50 text-emerald-700 border-emerald-200">Agendou</span>
          ) : null}
          {flags.map((f) => (
            <span key={f} title={FLAG_HINT[f]} className={`font-bold px-1.5 py-px rounded border ${FLAG_TONE[f]}`}>
              {FLAG_LABELS[f]}
            </span>
          ))}
          {cost ? <span className="text-slate-500">{money(cost * rate)}</span> : null}
          {first.leadId ? (
            <button
              type="button"
              onClick={() => openConversation(first)}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-[10px] font-bold hover:border-domu-blue/40"
            >
              <MessageSquareText className="w-3 h-3" /> Ver conversa
            </button>
          ) : null}
        </div>
        <div className="pl-3 border-l-2 border-slate-100 divide-y divide-slate-100">{visible.map((run) => renderRun(run, false))}</div>
        {group.runs.length > visible.length || isOpen ? (
          <button type="button" onClick={() => toggleExpanded(group.key)} className="text-[11px] font-bold text-domu-blue hover:underline">
            {isOpen
              ? problems.length
                ? 'Mostrar só o que precisa de atenção'
                : 'Mostrar só a última'
              : `Mostrar as ${group.runs.length} execuções do dia`}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 min-w-[200px]"
        >
          <option value="">Todos os clientes</option>
          {(metrics?.tenantOptions || []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Chip key={p.days} active={days === p.days} onClick={() => setDays(p.days)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            loadMetrics();
            loadRuns();
          }}
          className="ml-auto inline-flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-domu-blue/40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading || runsLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {missingTable ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{missingTable}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p> : null}

      {t && metrics ? (
        <>
          <p className="text-[11px] text-slate-500">
            Custos em reais no <strong>preço cheio do modelo</strong> (o que vale a partir de 2027), convertidos a R$ {rate.toFixed(2)} por
            dólar. Hoje a Google cobra a metade (promoção até 31/12/2026).
            {metrics.truncated ? ' Período com muitas execuções: números parciais, reduza o período.' : ''}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi
              label="Custo no período"
              value={money(t.costUsdFull * rate)}
              hint={`${usd(t.costUsdFull)} · hoje paga ${money(t.costUsd * rate)}`}
              tone="blue"
            />
            <Kpi
              label="Projeção 30 dias"
              value={money(((t.costUsdFull * rate) / metrics.periodDays) * 30)}
              hint="No ritmo do período"
            />
            <Kpi
              label="Custo por conversa"
              value={t.conversations ? money((t.costUsdFull * rate) / t.conversations) : '—'}
              hint={t.replied ? `${money((t.costUsdFull * rate) / t.replied)} por resposta` : undefined}
            />
            <Kpi label="Respostas enviadas" value={int(t.replied)} hint={`${int(t.conversations)} conversas · ${int(t.customers)} clientes finais`} tone="green" />
            <Kpi
              label="Taxa de sucesso"
              value={pct(t.replied, attempts)}
              hint={`${int(t.noReply)} sem resposta · ${int(t.failed)} falhas`}
              tone={attempts && t.replied / attempts < 0.95 ? 'red' : 'green'}
            />
            <Kpi label="Tempo até responder" value={seconds(t.avgResponseMs)} hint={`IA: média ${seconds(t.avgAiMs)} · 95% em até ${seconds(t.p95AiMs)}`} />
            <Kpi
              label="Agendamentos pela IA"
              value={int(t.bookings)}
              hint={`${pct(t.bookings, t.conversations)} das conversas viraram agendamento`}
              tone="green"
            />
            <Kpi label="Passou para a equipe" value={int(t.handoffs)} hint={`${pct(t.handoffs, t.conversations)} das conversas`} />
            <Kpi
              label="Tokens"
              value={int(t.inputTokens + t.outputTokens)}
              hint={`${int(t.inputTokens)} entrada · ${int(t.outputTokens)} saída · ${t.replied ? int(t.inputTokens / t.replied) : 0}/resposta`}
            />
            <Kpi
              label="Respostas para conferir"
              value={int(t.flagged)}
              hint={`${int(t.reviewedBad)} marcadas como erradas · ${int(t.reviewedOk)} certas`}
              tone={t.reviewedBad ? 'red' : t.flagged ? 'amber' : 'slate'}
            />
          </div>

          {/* Gráfico por dia */}
          <Panel title="Por dia" subtitle="Barra = custo no preço cheio · número = respostas enviadas">
            <div className="p-4 overflow-x-auto">
              <div className="flex items-end gap-1 h-40 min-w-max">
                {metrics.daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex flex-col items-center justify-end h-full w-7 group"
                    title={`${d.date.split('-').reverse().join('/')}: ${d.replied} respostas · ${money(d.costUsdFull * rate)}${d.failed ? ` · ${d.failed} falha(s)` : ''}`}
                  >
                    <span className="text-[9px] font-bold text-slate-500 mb-0.5">{d.replied || ''}</span>
                    <div
                      className={`w-full rounded-t ${d.failed ? 'bg-amber-400' : 'bg-domu-blue'} opacity-80 group-hover:opacity-100`}
                      style={{ height: `${Math.max(d.costUsdFull ? 4 : 1, (d.costUsdFull / maxDayCost) * 100)}%` }}
                    />
                    <div className="w-full bg-emerald-400/60 mt-0.5" style={{ height: `${(d.replied / maxDayRuns) * 6}px` }} />
                    <span className="text-[9px] text-slate-400 mt-1">{d.date.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Por cliente */}
          <Panel title="Por cliente" subtitle="Clique numa linha para filtrar tudo por esse cliente. Ordenado pelo custo.">
            {metrics.tenants.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">Nenhuma execução da atendente no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Cliente</th>
                      <th className="text-right px-3 py-2" title="Conversas usadas no mês corrente / cota do plano">Cota do mês</th>
                      <th className="text-right px-3 py-2">Respostas</th>
                      <th className="text-right px-3 py-2">Clientes finais</th>
                      <th className="text-right px-3 py-2">Agend.</th>
                      <th className="text-right px-3 py-2">Equipe</th>
                      <th className="text-right px-3 py-2">Falhas</th>
                      <th className="text-right px-3 py-2">Conferir</th>
                      <th className="text-right px-3 py-2">Tokens</th>
                      <th className="text-right px-3 py-2">Custo período</th>
                      <th className="text-right px-3 py-2">Por resposta</th>
                      <th className="text-right px-3 py-2">Projeção mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.tenants.map((row) => (
                      <tr
                        key={row.tenantId}
                        onClick={() => setTenantId(row.tenantId === tenantId ? '' : row.tenantId)}
                        className={`cursor-pointer hover:bg-slate-50 ${row.tenantId === tenantId ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {row.tenantName}
                          <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{row.planName}</span>
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-bold ${
                            row.quotaUsed >= row.quotaLimit ? 'text-red-600' : row.quotaUsed >= row.quotaLimit * 0.8 ? 'text-amber-600' : 'text-slate-700'
                          }`}
                        >
                          {int(row.quotaUsed)}/{int(row.quotaLimit)}
                        </td>
                        <td className="px-3 py-2 text-right">{int(row.replied)}</td>
                        <td className="px-3 py-2 text-right">{int(row.customers)}</td>
                        <td className="px-3 py-2 text-right">{int(row.bookings)}</td>
                        <td className="px-3 py-2 text-right">{int(row.handoffs)}</td>
                        <td className={`px-3 py-2 text-right ${row.failed + row.noReply ? 'text-red-600 font-bold' : ''}`}>{int(row.failed + row.noReply)}</td>
                        <td className={`px-3 py-2 text-right ${row.flagged ? 'text-amber-700 font-bold' : ''}`}>{int(row.flagged)}</td>
                        <td className="px-3 py-2 text-right">{int(row.inputTokens + row.outputTokens)}</td>
                        <td className="px-3 py-2 text-right font-bold">{money(row.costUsdFull * rate)}</td>
                        <td className="px-3 py-2 text-right">{row.replied ? money(row.costPerReplyUsdFull * rate) : '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-domu-blue">{money(row.projectedMonthUsdFull * rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Sinais para revisar" subtitle="Clique para ver as respostas">
              <div className="p-3 space-y-1.5">
                {metrics.flags.length === 0 ? <p className="text-xs text-slate-500">Nenhum sinal no período.</p> : null}
                {metrics.flags.map((f) => (
                  <button
                    key={f.flag}
                    type="button"
                    title={FLAG_HINT[f.flag]}
                    onClick={() => setFlagFilter(flagFilter === f.flag ? '' : f.flag)}
                    className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${FLAG_TONE[f.flag]} ${
                      flagFilter === f.flag ? 'ring-2 ring-domu-blue/40' : ''
                    }`}
                  >
                    <span className="font-bold">{f.label}</span>
                    <span className="font-black">{f.count}</span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Por que não respondeu" subtitle="Regras, falhas e mensagens trocadas">
              <div className="p-3 space-y-1.5">
                {metrics.reasons.length === 0 ? <p className="text-xs text-slate-500">Nada no período.</p> : null}
                {metrics.reasons.map((r) => (
                  <div key={`${r.status}-${r.reason}`} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">
                      <span className={`inline-block mr-1.5 text-[10px] font-bold px-1.5 py-px rounded border ${STATUS_LABEL[r.status].className}`}>
                        {STATUS_LABEL[r.status].text}
                      </span>
                      {REASON_LABEL[r.reason] || r.reason}
                    </span>
                    <span className="font-black text-slate-900">{r.count}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="O que a IA fez" subtitle="Ferramentas usadas nas respostas">
              <div className="p-3 space-y-1.5">
                {metrics.tools.length === 0 ? <p className="text-xs text-slate-500">Nenhuma ferramenta usada.</p> : null}
                {metrics.tools.map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{TOOL_LABEL[tool.name] || tool.name}</span>
                    <span className="font-black text-slate-900">{tool.count}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      ) : loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : null}

      {/* Monitor de conversas */}
      <Panel
        title="Monitor de conversas"
        subtitle="Abre só no que precisa de atenção: falhas, respostas que não saíram, marcadas como erradas e sinais suspeitos ainda não revisados. Cada cartão é um cliente num dia, com o resto da conversa a um clique."
      >
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={attention} onClick={() => setAttention(true)}>
              Precisa de atenção
            </Chip>
            <Chip active={!attention} onClick={() => setAttention(false)}>
              Todas
            </Chip>
            <span className="w-px h-5 bg-slate-200 mx-1" />
            <Chip active={grouped} onClick={() => setGrouped(true)}>
              Por conversa
            </Chip>
            <Chip active={!grouped} onClick={() => setGrouped(false)}>
              Por resposta
            </Chip>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchApplied(search);
              }}
              className="flex items-center gap-1 ml-auto"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar no texto"
                  className="text-[11px] bg-white border border-slate-200 rounded-md pl-7 pr-2 py-1 w-44"
                />
              </div>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssistantRunStatus | '')}
              className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1"
            >
              <option value="">Qualquer resultado</option>
              {(Object.keys(STATUS_LABEL) as AssistantRunStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s].text}
                </option>
              ))}
            </select>
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value as AssistantFlag | '')}
              className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1"
            >
              <option value="">Qualquer sinal</option>
              {(Object.keys(FLAG_LABELS) as AssistantFlag[]).map((f) => (
                <option key={f} value={f}>
                  {FLAG_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as '' | 'PENDING' | 'OK' | 'BAD')}
              className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1"
            >
              <option value="">Revisadas ou não</option>
              <option value="PENDING">Não revisadas</option>
              <option value="BAD">Marcadas como erradas</option>
              <option value="OK">Marcadas como certas</option>
            </select>
          </div>
        </div>

        {runsLoading && !runs.length ? <p className="p-4 text-xs text-slate-500">Carregando…</p> : null}
        {!runsLoading && !runs.length ? (
          <p className="p-4 text-xs text-slate-500">
            {attention ? 'Nada precisando de atenção no período. Para ver tudo, clique em "Todas".' : 'Nenhuma resposta com esses filtros.'}
          </p>
        ) : null}

        <div className="divide-y divide-slate-100">
          {grouped ? groups.map(renderGroup) : runs.map((run) => renderRun(run, true))}
        </div>
      </Panel>

      {conversation &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Fechar" onClick={() => setConversation(null)} />
            <div className="relative bg-white w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-slate-200 shadow-xl">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Conversa</h3>
                  <p className="text-[11px] text-slate-500">{conversation.title}</p>
                </div>
                <button type="button" onClick={() => setConversation(null)} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                {!conversationData ? <p className="text-xs text-slate-500">Carregando…</p> : null}
                {conversationData?.messages.map((m) => {
                  const inbound = m.direction === 'INBOUND';
                  const bot = m.senderType === 'BOT_AI';
                  return (
                    <div key={m.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap ${
                          inbound ? 'bg-white border border-slate-200 text-slate-800' : bot ? 'bg-blue-100 text-slate-900' : 'bg-emerald-100 text-slate-900'
                        }`}
                      >
                        {!inbound ? (
                          <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">{bot ? 'Atendente IA' : 'Equipe / campanha'}</p>
                        ) : null}
                        {m.body || '(mídia)'}
                        <p className="text-[9px] text-slate-400 text-right mt-0.5">{when(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {conversationData?.runs.length ? (
                <div className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500">
                  {conversationData.runs.length} execuções da IA ·{' '}
                  {money(conversationData.runs.reduce((s, r) => s + r.costUsdFull, 0) * rate)} no total ·{' '}
                  {conversationData.runs.filter((r) => r.flags.some((f) => f !== 'CHAMOU_EQUIPE')).length} com sinal para conferir
                </div>
              ) : null}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
