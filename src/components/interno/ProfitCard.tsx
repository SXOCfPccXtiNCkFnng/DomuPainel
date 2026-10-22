'use client';

import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { brl } from './contactFormat';

const COSTS_KEY = 'domu_interno_monthly_costs';

/** Lucro do mês = receita das assinaturas ativas − custos mensais informados (salvos neste navegador). */
export default function ProfitCard({ revenue, paying }: { revenue: number; paying: number }) {
  const [costs, setCosts] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const saved = Number(localStorage.getItem(COSTS_KEY));
    if (Number.isFinite(saved) && saved > 0) setCosts(saved);
  }, []);

  const save = () => {
    const value = Math.max(0, Number(draft.replace(/\./g, '').replace(',', '.')) || 0);
    setCosts(value);
    localStorage.setItem(COSTS_KEY, String(value));
    setEditing(false);
  };

  const profit = revenue - costs;

  return (
    <div className="rounded-xl border p-4 bg-white border-slate-200">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Lucro mensal</p>
        <button
          type="button"
          onClick={() => {
            setDraft(costs ? String(costs).replace('.', ',') : '');
            setEditing((v) => !v);
          }}
          title="Informar custos do mês"
          className="text-slate-400 hover:text-domu-blue"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className={`mt-1 text-2xl font-black ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>
        {brl(profit)}
      </p>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="mt-1.5 flex items-center gap-1.5"
        >
          <span className="text-[11px] text-slate-500">Custos R$</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder="0,00"
            className="w-24 text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-domu-blue"
          />
          <button type="submit" className="text-[11px] font-bold text-domu-blue">
            Salvar
          </button>
        </form>
      ) : (
        <p className="mt-0.5 text-[11px] text-slate-400">
          Receita {brl(revenue)} − custos {brl(costs)}
          {paying ? ` · ticket médio ${brl(revenue / paying)}` : ''}
          {!costs ? ' · clique no lápis para informar os custos' : ''}
        </p>
      )}
    </div>
  );
}
