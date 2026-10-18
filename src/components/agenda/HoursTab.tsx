'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Car, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import {
  BOOKING_HORIZON_OPTIONS,
  CAPACITY_MAX,
  DEFAULT_SCHEDULING_SETTINGS,
  formatDuration,
  MIN_NOTICE_OPTIONS,
  SLOT_STEP_OPTIONS,
  WEEKDAY_LABELS,
  type DayHours,
  type SchedulingSettings,
} from '@/lib/scheduling';
import { agendaInputClass } from './agendaStyles';

/** Segunda primeiro, domingo por último — como o dono pensa a semana. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function HoursTab() {
  const [form, setForm] = useState<SchedulingSettings>(DEFAULT_SCHEDULING_SETTINGS);
  const [saved, setSaved] = useState<SchedulingSettings>(DEFAULT_SCHEDULING_SETTINGS);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/scheduling/settings');
        const json = await res.json();
        if (!json.success) {
          setError(json.error || 'Não foi possível carregar o horário.');
          return;
        }
        setForm(json.settings);
        setSaved(json.settings);
        setCanEdit(Boolean(json.canEdit));
      } catch {
        setError('Não foi possível carregar o horário.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const updateDay = (index: number, patch: Partial<DayHours>) => {
    setForm((f) => ({
      ...f,
      weekly_hours: f.weekly_hours.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));
    setNotice(null);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/scheduling/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível salvar.');
        return;
      }
      setForm(json.settings);
      setSaved(json.settings);
      setNotice('Horário salvo.');
    } catch {
      setError('Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando horário...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </p>
      )}
      {!canEdit && (
        <p className="text-[11px] text-slate-500">Só administradores podem alterar o horário de funcionamento.</p>
      )}

      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-domu-blue" />
          <h2 className="text-sm font-black text-slate-900">Horário de funcionamento</h2>
        </div>
        <p className="text-[11px] text-slate-500">
          Os horários livres oferecidos ao cliente respeitam estes dias e a duração de cada serviço.
        </p>
        <div className="divide-y divide-slate-100">
          {DISPLAY_ORDER.map((index) => {
            const day = form.weekly_hours[index];
            return (
              <div key={index} className="flex flex-wrap items-center gap-3 py-2.5">
                <label className="flex items-center gap-2 w-32 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    disabled={!canEdit}
                    onChange={(e) => updateDay(index, { enabled: e.target.checked })}
                    className="rounded border-slate-300 text-domu-blue focus:ring-domu-blue"
                  />
                  {WEEKDAY_LABELS[index]}
                </label>
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.open}
                      disabled={!canEdit}
                      onChange={(e) => updateDay(index, { open: e.target.value })}
                      className={`${agendaInputClass} w-28`}
                      aria-label={`Abertura ${WEEKDAY_LABELS[index]}`}
                    />
                    <span className="text-xs text-slate-400">até</span>
                    <input
                      type="time"
                      value={day.close}
                      disabled={!canEdit}
                      onChange={(e) => updateDay(index, { close: e.target.value })}
                      className={`${agendaInputClass} w-28`}
                      aria-label={`Fechamento ${WEEKDAY_LABELS[index]}`}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Car className="w-4 h-4 text-domu-blue mt-0.5" />
            <div>
              <h2 className="text-sm font-black text-slate-900">Atender mais de um carro ao mesmo tempo</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Ligue se você tem mais de um box ou equipe. Desligado, a agenda aceita um carro por vez.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.capacity > 1}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.checked ? 2 : 1 }))}
            className="mt-1 rounded border-slate-300 text-domu-blue focus:ring-domu-blue"
            aria-label="Atender mais de um carro ao mesmo tempo"
          />
        </div>
        {form.capacity > 1 && (
          <div className="space-y-2 pl-6">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              Carros ao mesmo tempo:
              <input
                type="number"
                min={2}
                max={CAPACITY_MAX}
                value={form.capacity}
                disabled={!canEdit}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  setForm((f) => ({ ...f, capacity: Math.min(CAPACITY_MAX, Math.max(2, n || 2)) }));
                }}
                className={`${agendaInputClass} w-20`}
              />
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Exemplo com {form.capacity}: às 9h cabem {form.capacity} carros. Um polimento de 4h ocupa uma vaga das
              9h às 13h, e as outras {form.capacity - 1} continuam livres para outros serviços.
            </p>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
        <h2 className="text-sm font-black text-slate-900">Regras de agendamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-600">Intervalo entre horários</span>
            <select
              value={form.slot_step_minutes}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, slot_step_minutes: Number(e.target.value) }))}
              className={agendaInputClass}
            >
              {SLOT_STEP_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  A cada {formatDuration(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-600">Antecedência mínima</span>
            <select
              value={form.min_notice_minutes}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, min_notice_minutes: Number(e.target.value) }))}
              className={agendaInputClass}
            >
              {MIN_NOTICE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Sem antecedência' : m === 1440 ? '1 dia antes' : `${formatDuration(m)} antes`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-600">Agendar até</span>
            <select
              value={form.booking_horizon_days}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, booking_horizon_days: Number(e.target.value) }))}
              className={agendaInputClass}
            >
              {BOOKING_HORIZON_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} dias à frente
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || isSaving}
            className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar horário
          </button>
        </div>
      )}
    </div>
  );
}
