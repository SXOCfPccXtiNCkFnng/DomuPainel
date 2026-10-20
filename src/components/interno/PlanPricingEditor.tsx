'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import type { PlanTier } from '@/lib/planLimits';

const TIERS: PlanTier[] = ['STARTER', 'PRO', 'ENTERPRISE'];
const TIER_LABELS: Record<PlanTier, string> = { STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' };

/** Somente Disparos só existe no Starter. */
const tiersFor = (segment: string): PlanTier[] => (segment === 'marketing_apenas' ? ['STARTER'] : TIERS);

type Table = {
  defaults: Record<PlanTier, number>;
  overrides: Record<string, Partial<Record<PlanTier, number>>>;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Preço dos planos no /interno: o padrão (todos os ramos) e o preço próprio
 * de cada ramo. Ramo sem preço próprio usa o padrão.
 */
export default function PlanPricingEditor() {
  const [table, setTable] = useState<Table | null>(null);
  const [segment, setSegment] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/interno/plans', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (json.success) setTable({ defaults: json.defaults, overrides: json.overrides || {} });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Ao trocar o ramo, o rascunho mostra o que vale para ele (vazio = usa o padrão).
  useEffect(() => {
    if (!table) return;
    const values = segment ? table.overrides[segment] || {} : table.defaults;
    setDraft(Object.fromEntries(TIERS.map((t) => [t, values[t] != null ? String(values[t]) : ''])));
    setMsg('');
  }, [segment, table]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const prices: Record<string, number | null> = {};
    for (const tier of tiersFor(segment)) {
      const raw = (draft[tier] || '').trim().replace(',', '.');
      if (!raw && segment) {
        prices[tier] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        setMsg(`Preço inválido para o ${TIER_LABELS[tier]}.`);
        return;
      }
      prices[tier] = value;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/interno/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: segment || null, prices }),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg(json.error || 'Não foi possível salvar.');
        return;
      }
      const parts = [
        segment
          ? `Preço do ramo ${SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS]} atualizado.`
          : 'Preço padrão atualizado (vale para os ramos sem preço próprio).',
      ];
      if (json.loweredNow > 0) parts.push(`${json.loweredNow} assinante(s) teve(ram) o valor reduzido na hora.`);
      if (json.scheduledIncreases > 0) {
        parts.push(`${json.scheduledIncreases} assinante(s) avisado(s) por e-mail: o aumento entra em vigor em 30 dias.`);
      }
      setMsg(parts.join(' '));
      await load();
    } catch {
      setMsg('Erro de conexão ao salvar os preços.');
    } finally {
      setSaving(false);
    }
  };

  const ownSegments = table ? Object.keys(table.overrides).filter((s) => Object.keys(table.overrides[s]).length) : [];

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900">Preço dos planos</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          O padrão vale para todos os ramos; cada ramo pode ter preço próprio. Vale na hora para cadastro novo e
          troca/reativação de plano. Assinantes ativos do ramo: redução aplica na hora; aumento é avisado por e-mail e
          entra na cobrança em 30 dias (Termos de Uso, seção 6).
        </p>
      </div>

      <label className="block text-xs font-bold text-slate-600 max-w-xs">
        Ramo
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
        >
          <option value="">Padrão (todos os ramos)</option>
          {Object.entries(SEGMENT_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
              {ownSegments.includes(id) ? ' · preço próprio' : ''}
            </option>
          ))}
        </select>
      </label>

      <form onSubmit={save} className="flex flex-wrap gap-3 items-end">
        {tiersFor(segment).map((tier) => (
          <label key={tier} className="text-xs font-bold text-slate-600">
            {TIER_LABELS[tier]}
            <div className="mt-1 flex items-center gap-1">
              <span className="text-slate-400 text-sm">R$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={draft[tier] ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, [tier]: e.target.value }))}
                placeholder={segment && table ? String(table.defaults[tier]) : ''}
                className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
              />
            </div>
            {segment && table && !draft[tier] && (
              <span className="block text-[10px] font-medium text-slate-400 mt-0.5">usa o padrão ({brl(table.defaults[tier])})</span>
            )}
          </label>
        ))}
        <button type="submit" disabled={saving || !table} className="btn-domu-primary text-xs py-2 px-4 disabled:opacity-50">
          {saving ? 'Salvando…' : 'Salvar preços'}
        </button>
      </form>
      {segment && <p className="text-[10.5px] text-slate-400">Deixe em branco para o ramo voltar a usar o preço padrão.</p>}
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </section>
  );
}
