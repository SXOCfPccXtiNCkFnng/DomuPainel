'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Mail, MessageCircle, RefreshCw, Search } from 'lucide-react';
import type { PaymentState, PlatformUserRow, PlatformUsersSummary } from '@/lib/platformUsers';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { PAYMENT_BADGE, formatPhone, fullDate, relativeTime, whatsappLink } from './contactFormat';

const DAY_MS = 24 * 60 * 60 * 1000;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Dono',
  ADMIN: 'Administrador',
  BROKER: 'Corretor',
  DISPATCHER: 'Disparos',
  ATTENDANT: 'Atendente',
};

type PaymentFilter = 'all' | 'paying' | 'courtesy' | 'trial' | 'not_paying';
type LoginFilter = 'all' | '24h' | '7d' | 'inactive30' | 'never';
type SortKey = 'lastLogin' | 'createdAt' | 'name';

const NOT_PAYING: PaymentState[] = ['PENDING', 'PAST_DUE', 'CANCELED', 'NONE'];

const relative = (iso: string | null) => relativeTime(iso, 'Nunca entrou');

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: PlatformUserRow[]) {
  const header = ['Nome', 'E-mail', 'Telefone', 'Empresa', 'Módulo', 'Papel', 'Pagamento', 'Plano', 'Valor mensal', 'Vence em', 'Último login', 'Cadastro'];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      formatPhone(r.phone),
      r.companyName,
      SEGMENT_LABELS[r.segment as keyof typeof SEGMENT_LABELS] || r.segment,
      ROLE_LABELS[r.role] || r.role,
      PAYMENT_BADGE[r.paymentState].text,
      r.planTier || '',
      r.monthlyPrice != null ? r.monthlyPrice.toFixed(2).replace('.', ',') : '',
      r.periodEnd ? fullDate(r.periodEnd) : '',
      r.lastLoginAt ? fullDate(r.lastLoginAt) : 'Nunca',
      fullDate(r.createdAt),
    ]
      .map(csvCell)
      .join(';')
  );
  // BOM para o Excel abrir com acento certo.
  const blob = new Blob(['\uFEFF' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cadastros-domu-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, hint, tone = 'text-slate-900', active, onClick }: {
  label: string;
  value: number;
  hint?: string;
  tone?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 bg-white transition-colors ${
        active ? 'border-domu-blue ring-1 ring-domu-blue/30' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </button>
  );
}

export default function UsersMonitor() {
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [summary, setSummary] = useState<PlatformUsersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState<PaymentFilter>('all');
  const [login, setLogin] = useState<LoginFilter>('all');
  const [sort, setSort] = useState<SortKey>('lastLogin');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/interno/users', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar os cadastros.');
        return;
      }
      setUsers(json.users || []);
      setSummary(json.summary || null);
      setError('');
    } catch {
      setError('Não foi possível carregar os cadastros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, { intervalMs: 60_000 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const now = Date.now();
    const age = (iso: string | null) => (iso ? now - new Date(iso).getTime() : Infinity);

    const list = users.filter((u) => {
      if (q) {
        const hit =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.companyName.toLowerCase().includes(q) ||
          (qDigits.length >= 4 && u.phone.replace(/\D/g, '').includes(qDigits));
        if (!hit) return false;
      }
      if (payment === 'paying' && u.paymentState !== 'PAYING') return false;
      if (payment === 'courtesy' && u.paymentState !== 'COURTESY') return false;
      if (payment === 'trial' && u.paymentState !== 'TRIAL') return false;
      if (payment === 'not_paying' && !NOT_PAYING.includes(u.paymentState)) return false;
      if (login === '24h' && age(u.lastLoginAt) > DAY_MS) return false;
      if (login === '7d' && age(u.lastLoginAt) > 7 * DAY_MS) return false;
      if (login === 'inactive30' && !(u.lastLoginAt && age(u.lastLoginAt) > 30 * DAY_MS)) return false;
      if (login === 'never' && u.lastLoginAt) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      const key = sort === 'lastLogin' ? 'lastLoginAt' : 'createdAt';
      return (b[key] ? new Date(b[key]!).getTime() : 0) - (a[key] ? new Date(a[key]!).getTime() : 0);
    });
  }, [users, search, payment, login, sort]);

  const s = summary;
  const toggleLogin = (f: LoginFilter) => setLogin((cur) => (cur === f ? 'all' : f));
  const togglePayment = (f: PaymentFilter) => setPayment((cur) => (cur === f ? 'all' : f));

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p> : null}

      {s ? (
        <>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-2">Acesso</p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Cadastrados" value={s.total} hint="Pessoas com login" active={login === 'all' && payment === 'all'} onClick={() => { setLogin('all'); setPayment('all'); }} />
              <Stat label="Entraram em 24h" value={s.login24h} tone="text-emerald-600" active={login === '24h'} onClick={() => toggleLogin('24h')} />
              <Stat label="Entraram em 7 dias" value={s.login7d} tone="text-domu-blue" active={login === '7d'} onClick={() => toggleLogin('7d')} />
              <Stat label="Sumidos (30+ dias)" value={s.inactive30d} tone="text-amber-600" active={login === 'inactive30'} onClick={() => toggleLogin('inactive30')} />
              <Stat label="Nunca entraram" value={s.neverLogged} tone="text-slate-500" active={login === 'never'} onClick={() => toggleLogin('never')} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-2">Pagamento (pela empresa de cada pessoa)</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Pagando" value={s.paying} tone="text-emerald-600" active={payment === 'paying'} onClick={() => togglePayment('paying')} />
              <Stat label="Cortesia" value={s.courtesy} hint="Liberado sem cobrança" tone="text-violet-600" active={payment === 'courtesy'} onClick={() => togglePayment('courtesy')} />
              <Stat label="Trial" value={users.filter((u) => u.paymentState === 'TRIAL').length} tone="text-sky-600" active={payment === 'trial'} onClick={() => togglePayment('trial')} />
              <Stat label="Não pagando" value={s.notPaying} hint="Não pagou, atraso, cancelou ou sem plano" tone="text-red-600" active={payment === 'not_paying'} onClick={() => togglePayment('not_paying')} />
            </div>
          </div>
        </>
      ) : null}

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-black text-slate-900 mr-auto">
            {loading ? 'Carregando cadastros…' : `${filtered.length} de ${users.length} pessoa(s)`}
          </h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, e-mail, telefone ou empresa"
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-60"
            />
          </div>
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentFilter)}
            aria-label="Filtrar por pagamento"
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="all">Todos os pagamentos</option>
            <option value="paying">Pagando</option>
            <option value="courtesy">Cortesia</option>
            <option value="trial">Trial</option>
            <option value="not_paying">Não pagando</option>
          </select>
          <select
            value={login}
            onChange={(e) => setLogin(e.target.value as LoginFilter)}
            aria-label="Filtrar por login"
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="all">Qualquer login</option>
            <option value="24h">Entrou em 24h</option>
            <option value="7d">Entrou em 7 dias</option>
            <option value="inactive30">Sumido há 30+ dias</option>
            <option value="never">Nunca entrou</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Ordenar"
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="lastLogin">Último login</option>
            <option value="createdAt">Mais recentes</option>
            <option value="name">Nome (A–Z)</option>
          </select>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={!filtered.length}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-domu-blue/40 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Exportar planilha
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            aria-label="Atualizar"
            className="inline-flex items-center text-slate-600 border border-slate-200 rounded-lg p-1.5 hover:border-domu-blue/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[980px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-bold">Pessoa</th>
                <th className="px-4 py-2 font-bold">Contato</th>
                <th className="px-4 py-2 font-bold">Empresa</th>
                <th className="px-4 py-2 font-bold">Pagamento</th>
                <th className="px-4 py-2 font-bold">Último login</th>
                <th className="px-4 py-2 font-bold">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const badge = PAYMENT_BADGE[u.paymentState];
                const wa = whatsappLink(u.phone);
                const loginAge = u.lastLoginAt ? Date.now() - new Date(u.lastLoginAt).getTime() : Infinity;
                return (
                  <tr key={u.userId} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-900">{u.name || '—'}</p>
                      <p className="text-[11px] text-slate-400">{ROLE_LABELS[u.role] || u.role}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs space-y-1">
                      <a href={`mailto:${u.email}`} className="flex items-center gap-1.5 text-slate-700 hover:text-domu-blue break-all">
                        <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {u.email}
                      </a>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700">
                          <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> {formatPhone(u.phone)}
                        </a>
                      ) : (
                        <p className="text-slate-400">Sem telefone</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-800">{u.companyName}</p>
                      <p className="text-[11px] text-slate-400">
                        {SEGMENT_LABELS[u.segment as keyof typeof SEGMENT_LABELS] || u.segment}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex text-[11px] font-bold border rounded-full px-2 py-0.5 ${badge.className}`}>{badge.text}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.planTier || '—'}
                        {u.monthlyPrice ? ` · ${u.monthlyPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                      </p>
                      {u.periodEnd && u.paymentState !== 'NONE' ? (
                        <p className="text-[11px] text-slate-400">vence {new Date(u.periodEnd).toLocaleDateString('pt-BR')}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-xs" title={fullDate(u.lastLoginAt)}>
                      <span
                        className={`font-bold ${
                          !u.lastLoginAt
                            ? 'text-slate-400'
                            : loginAge <= DAY_MS
                              ? 'text-emerald-700'
                              : loginAge > 30 * DAY_MS
                                ? 'text-amber-700'
                                : 'text-slate-700'
                        }`}
                      >
                        {relative(u.lastLoginAt)}
                      </span>
                      {u.lastLoginAt ? <p className="text-[11px] text-slate-400">{fullDate(u.lastLoginAt)}</p> : null}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fullDate(u.createdAt)}</td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    Ninguém com esses filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
