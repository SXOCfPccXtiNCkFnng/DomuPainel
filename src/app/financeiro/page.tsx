'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import { formatMoneyInput } from '@/lib/realEstate';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceEntry,
  type FinanceKind,
  type FinanceSummary,
} from '@/lib/finance';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function todayKey(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-1">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p
        className={`text-xl font-black tracking-tight ${
          tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10.5px] text-slate-400">{hint}</p>}
    </div>
  );
}

const EMPTY_FORM = { kind: 'EXPENSE' as FinanceKind, description: '', category: '', amount: '', occurred_on: '' };

export default function FinanceiroPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [entriesAvailable, setEntriesAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (target: string | null) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/finance${target ? `?month=${target}` : ''}`);
      const json = await res.json();
      if (!json.success) {
        setError(res.status === 403 ? 'Só administradores veem o financeiro.' : json.error || 'Não foi possível carregar.');
        return;
      }
      setMonth(json.month);
      setSummary(json.summary);
      setEntries(json.entries || []);
      setEntriesAvailable(json.entriesAvailable !== false);
      setError(null);
    } catch {
      setError('Não foi possível carregar o financeiro.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  const openForm = (kind: FinanceKind) => {
    setForm({ ...EMPTY_FORM, kind, occurred_on: todayKey() });
    setFormError(null);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || 'Não foi possível salvar.');
        return;
      }
      setShowForm(false);
      // O lançamento pode ser de outro mês: abre o mês dele.
      load(String(form.occurred_on).slice(0, 7));
    } catch {
      setFormError('Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (entry: FinanceEntry) => {
    const res = await fetch(`/api/finance?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setError(json.error || 'Não foi possível apagar.');
      return;
    }
    load(month);
  };

  const categories = form.kind === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl p-1">
          <button
            type="button"
            disabled={!month || isLoading}
            onClick={() => month && load(shiftMonth(month, -1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-black text-slate-900 px-2 min-w-[150px] text-center">
            {month ? monthLabel(month) : '...'}
          </span>
          <button
            type="button"
            disabled={!month || isLoading}
            onClick={() => month && load(shiftMonth(month, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {entriesAvailable && !error && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openForm('EXPENSE')}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-600 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Lançar gasto
            </button>
            <button
              type="button"
              onClick={() => openForm('INCOME')}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Lançar entrada
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {!entriesAvailable && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          O faturamento pela agenda já aparece. Para lançar gastos, falta ativar o financeiro no banco.
        </p>
      )}

      {showForm && (
        <form onSubmit={save} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900">
            {form.kind === 'EXPENSE' ? 'Novo gasto' : 'Nova entrada (fora da agenda)'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-[11px] font-bold text-slate-600">Descrição</span>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={form.kind === 'EXPENSE' ? 'Ex.: Shampoo e produtos, Aluguel de outubro' : 'Ex.: Venda de pomada'}
                className={agendaInputClass}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Categoria</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={agendaInputClass}
                required
              >
                <option value="">Escolha</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Valor (R$)</span>
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: formatMoneyInput(e.target.value) }))}
                placeholder="Ex.: 150,00"
                className={agendaInputClass}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Data</span>
              <input
                type="date"
                value={form.occurred_on}
                onChange={(e) => setForm((f) => ({ ...f, occurred_on: e.target.value }))}
                className={agendaInputClass}
                required
              />
            </label>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="btn-domu-primary text-xs py-2 px-5 flex items-center gap-2 disabled:opacity-50">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      )}

      {isLoading && !summary ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando financeiro...
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Faturamento pela agenda" value={brl(summary.revenue)} hint={`${summary.done} atendimentos feitos`} />
            <Stat label="Outras entradas" value={brl(summary.otherIncome)} hint="Lançadas à mão" />
            <Stat label="Gastos" value={brl(summary.expenses)} hint="Lançados à mão" />
            <Stat
              label="Lucro"
              value={brl(summary.profit)}
              hint="Faturamento + entradas − gastos"
              tone={summary.profit >= 0 ? 'good' : 'bad'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Ticket médio" value={brl(summary.averageTicket)} hint="Por atendimento com preço" />
            <Stat
              label="Previsto no resto do mês"
              value={brl(summary.upcomingRevenue)}
              hint={`${summary.upcoming} agendamentos confirmados`}
            />
            <Stat
              label="Perdido com faltas e cancelamentos"
              value={brl(summary.lostRevenue)}
              hint={`${summary.lost} agendamentos`}
              tone={summary.lost ? 'bad' : undefined}
            />
          </div>

          <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Conta como feito o agendamento concluído ou confirmado cujo horário já passou. Marque na Agenda quem faltou
            ou cancelou para o número ficar certo.
            {summary.doneWithoutPrice > 0 &&
              ` ${summary.doneWithoutPrice} atendimento(s) foram de serviços sem preço e não entram no faturamento.`}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-2">
              <h2 className="text-sm font-black text-slate-900">Por serviço</h2>
              {summary.byService.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum atendimento feito neste mês.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {summary.byService.map((s) => (
                    <div key={s.service} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="font-semibold text-slate-800">{s.service}</span>
                      <span className="text-slate-500 shrink-0">
                        {s.count}× · <strong className="text-slate-900">{brl(s.revenue)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-2">
              <h2 className="text-sm font-black text-slate-900">Gastos por categoria</h2>
              {summary.expensesByCategory.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum gasto lançado neste mês.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {summary.expensesByCategory.map((c) => (
                    <div key={c.category} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="font-semibold text-slate-800">{c.category}</span>
                      <strong className="text-slate-900 shrink-0">{brl(c.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-2">
            <h2 className="text-sm font-black text-slate-900">Lançamentos do mês</h2>
            {entries.length === 0 ? (
              <p className="text-xs text-slate-400">
                Nenhum lançamento. Use “Lançar gasto” para produtos, aluguel, comissões e contas, e “Lançar entrada” para
                vendas fora da agenda.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{e.description}</p>
                      <p className="text-[10.5px] text-slate-400">
                        {e.occurred_on.split('-').reverse().join('/')} · {e.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <strong className={e.kind === 'EXPENSE' ? 'text-red-600' : 'text-emerald-700'}>
                        {e.kind === 'EXPENSE' ? '−' : '+'} {brl(e.amount)}
                      </strong>
                      <button
                        type="button"
                        onClick={() => remove(e)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label={`Apagar ${e.description}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
