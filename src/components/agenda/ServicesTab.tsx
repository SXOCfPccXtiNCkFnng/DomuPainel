'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import {
  formatDuration,
  formatPrice,
  SERVICE_DURATION_OPTIONS,
  SERVICE_NAME_MAX,
  type ServiceItem,
} from '@/lib/scheduling';
import { agendaInputClass } from './agendaStyles';
import { useSchedulingCopy } from '@/hooks/useSchedulingCopy';

/** price: número em texto com ponto decimal ("50.00") — formato que a API aceita. */
type FormState = { name: string; duration_minutes: number; price: string; description: string };

/** Máscara de valor: os dígitos entram como centavos (digitar 5000 mostra R$ 50,00). */
function priceFromTyped(typed: string): string {
  const digits = typed.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
  return digits ? (Number(digits) / 100).toFixed(2) : '';
}

const EMPTY_FORM: FormState = { name: '', duration_minutes: 30, price: '', description: '' };


export default function ServicesTab({
  services,
  onChanged,
}: {
  services: ServiceItem[];
  onChanged: () => void;
}) {
  const { copy } = useSchedulingCopy();
  /** Sugestões do ramo para começar com um clique. */
  const SUGGESTIONS: FormState[] = copy.serviceSuggestions;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = (preset: FormState = EMPTY_FORM) => {
    setForm(preset);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (s: ServiceItem) => {
    setForm({
      name: s.name,
      duration_minutes: s.duration_minutes,
      price: s.price == null ? '' : s.price.toFixed(2),
      description: s.description || '',
    });
    setEditingId(s.id);
    setShowForm(true);
    setError(null);
  };

  const request = async (url: string, init: RequestInit) => {
    setError(null);
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setError(json.error || 'Não foi possível salvar o serviço.');
      return false;
    }
    onChanged();
    return true;
  };

  const save = async () => {
    setIsSaving(true);
    const ok = await request(
      editingId ? `/api/scheduling/services?id=${encodeURIComponent(editingId)}` : '/api/scheduling/services',
      { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(form) }
    );
    setIsSaving(false);
    if (ok) setShowForm(false);
  };

  const toggleActive = (s: ServiceItem) =>
    request(`/api/scheduling/services?id=${encodeURIComponent(s.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !s.active }),
    });

  const remove = (s: ServiceItem) => {
    if (!window.confirm(`Excluir o serviço "${s.name}"? Agendamentos antigos continuam no histórico.`)) return;
    request(`/api/scheduling/services?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
  };

  const durationOptions = (SERVICE_DURATION_OPTIONS as readonly number[]).includes(form.duration_minutes)
    ? SERVICE_DURATION_OPTIONS
    : [...SERVICE_DURATION_OPTIONS, form.duration_minutes].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-500 max-w-lg">
          A duração define quanto tempo o serviço ocupa na agenda. O robô do WhatsApp só oferece horários em que o
          serviço inteiro cabe.
        </p>
        {!showForm && (
          <button
            type="button"
            onClick={() => openNew()}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Novo serviço
          </button>
        )}
      </div>

      {showForm && (
        <section className="bg-white rounded-2xl border border-domu-blue/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">{editingId ? 'Editar serviço' : 'Novo serviço'}</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1.5 sm:col-span-3">
              <span className="block text-[11px] font-bold text-slate-600">Nome</span>
              <input
                value={form.name}
                maxLength={SERVICE_NAME_MAX}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={copy.servicePlaceholder}
                className={agendaInputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Duração</span>
              <select
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                className={agendaInputClass}
              >
                {durationOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Preço</span>
              <input
                value={form.price === '' ? '' : formatPrice(Number(form.price))}
                inputMode="numeric"
                onChange={(e) => setForm((f) => ({ ...f, price: priceFromTyped(e.target.value) }))}
                placeholder="R$ 0,00 (opcional)"
                className={agendaInputClass}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-3">
              <span className="block text-[11px] font-bold text-slate-600">Descrição</span>
              <input
                value={form.description}
                maxLength={500}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional — o robô usa para explicar o serviço ao cliente"
                className={agendaInputClass}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={isSaving || form.name.trim().length < 2}
              className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Salvar alterações' : 'Adicionar serviço'}
            </button>
          </div>
        </section>
      )}

      {services.length === 0 ? (
        !showForm && (
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-domu-blue" />
            <h2 className="text-sm font-black text-slate-900">
              {SUGGESTIONS.length ? 'Comece com uma sugestão' : 'Cadastre seus serviços'}
            </h2>
          </div>
          <p className="text-[11px] text-slate-500">
            {SUGGESTIONS.length
              ? 'Clique para preencher e ajuste preço e duração antes de salvar.'
              : 'Cada serviço tem nome, duração e preço (opcional). A duração é o tempo que ele ocupa na agenda. Se precisar de avaliação antes, escreva isso na descrição: a atendente vai oferecer a avaliação.'}
          </p>
          {!SUGGESTIONS.length && (
            <button type="button" onClick={() => openNew()} className="btn-domu-primary text-xs py-2 px-4 w-fit flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Cadastrar primeiro serviço
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => openNew(s)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-domu-blue hover:bg-blue-50"
              >
                + {s.name} · {formatDuration(s.duration_minutes)}
              </button>
            ))}
          </div>
        </section>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
          {services.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className={s.active ? '' : 'opacity-50'}>
                <p className="text-sm font-bold text-slate-900">
                  {s.name}
                  {!s.active && <span className="ml-2 text-[10px] font-bold text-slate-500 uppercase">Pausado</span>}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatDuration(s.duration_minutes)} · {formatPrice(s.price)}
                  {s.description ? ` · ${s.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleActive(s)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  {s.active ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-domu-blue hover:bg-blue-50"
                  aria-label={`Editar ${s.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50"
                  aria-label={`Excluir ${s.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
