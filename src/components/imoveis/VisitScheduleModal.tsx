'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, CalendarCheck, Loader2, X } from 'lucide-react';
import { useBackdropClose, useModalA11y } from '@/hooks/useModalA11y';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import { reminderLabel, VISIT_REMINDER_PRESETS } from '@/lib/visitReminderRules';

export type VisitScheduleValues = {
  scheduledAt: string;
  reminderMinutes: number | null;
  propertyId?: string | null;
  notes?: string;
};

type PropertyOption = { id: string; label: string };

const UNITS = { min: 1, h: 60, d: 1440 } as const;
type Unit = keyof typeof UNITS;

/** "2026-10-30T15:00" no fuso do navegador (o que o input datetime-local espera). */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Data e hora da visita + aviso ao cliente pelo WhatsApp com a antecedência
 * que o corretor escolher (atalhos ou tempo livre).
 */
export default function VisitScheduleModal({
  isOpen,
  title,
  customerName,
  hint,
  initialScheduledAt,
  initialReminderMinutes,
  properties,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  customerName: string;
  /** Ex.: a preferência que o cliente disse para a atendente. */
  hint?: string | null;
  initialScheduledAt?: string | null;
  initialReminderMinutes?: number | null;
  /** Lista de imóveis para escolher (agendamento direto pelo lead). */
  properties?: PropertyOption[];
  onClose: () => void;
  /** Devolve a mensagem de erro, ou null se deu certo. */
  onSubmit: (values: VisitScheduleValues) => Promise<string | null>;
}) {
  const [when, setWhen] = useState('');
  const [remind, setRemind] = useState(true);
  const [preset, setPreset] = useState<string>('60');
  const [customValue, setCustomValue] = useState('1');
  const [customUnit, setCustomUnit] = useState<Unit>('h');
  const [propertyId, setPropertyId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);
  const backdropProps = useBackdropClose(onClose);

  useEffect(() => {
    if (!isOpen) return;
    setWhen(initialScheduledAt ? toLocalInput(new Date(initialScheduledAt)) : '');
    const minutes = initialReminderMinutes ?? 60;
    setRemind(initialReminderMinutes !== null || !initialScheduledAt);
    if ((VISIT_REMINDER_PRESETS as readonly number[]).includes(minutes)) {
      setPreset(String(minutes));
    } else {
      setPreset('custom');
      if (minutes % 1440 === 0) {
        setCustomValue(String(minutes / 1440));
        setCustomUnit('d');
      } else if (minutes % 60 === 0) {
        setCustomValue(String(minutes / 60));
        setCustomUnit('h');
      } else {
        setCustomValue(String(minutes));
        setCustomUnit('min');
      }
    }
    setPropertyId('');
    setNotes('');
    setError(null);
  }, [isOpen, initialScheduledAt, initialReminderMinutes]);

  if (!isOpen || typeof document === 'undefined') return null;

  const reminderMinutes = !remind
    ? null
    : preset === 'custom'
      ? Math.round(Number(customValue) * UNITS[customUnit])
      : Number(preset);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) return setError('Informe a data e a hora da visita.');
    if (remind && (!reminderMinutes || reminderMinutes < 5)) return setError('O aviso precisa ser de pelo menos 5 minutos antes.');
    setIsSaving(true);
    setError(null);
    const failure = await onSubmit({
      scheduledAt: new Date(when).toISOString(),
      reminderMinutes,
      ...(properties ? { propertyId: propertyId || null, notes } : {}),
    });
    setIsSaving(false);
    if (failure) setError(failure);
    else onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      {...backdropProps}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-schedule-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="visit-schedule-title" className="text-sm font-black text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-domu-blue" /> {title}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Cliente: <strong className="text-slate-900">{customerName}</strong>
            {hint ? <span className="block text-[11px] text-slate-500 mt-0.5">Preferência dele: {hint}</span> : null}
          </p>

          {properties && (
            <label className="block space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Imóvel</span>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={agendaInputClass}>
                <option value="">Sem imóvel definido</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">Data e hora da visita</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={agendaInputClass} required />
          </label>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={remind}
                onChange={(e) => setRemind(e.target.checked)}
                className="rounded border-slate-300 text-domu-blue focus:ring-domu-blue"
              />
              Avisar o cliente pelo WhatsApp antes da visita
            </label>
            {remind && (
              <div className="pl-6 space-y-2">
                <select value={preset} onChange={(e) => setPreset(e.target.value)} className={agendaInputClass} aria-label="Quanto tempo antes">
                  {VISIT_REMINDER_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      {reminderLabel(m)} antes
                    </option>
                  ))}
                  <option value="custom">Outro tempo...</option>
                </select>
                {preset === 'custom' && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      className={`${agendaInputClass} w-24`}
                      aria-label="Quantidade"
                    />
                    <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as Unit)} className={agendaInputClass} aria-label="Unidade">
                      <option value="min">minutos antes</option>
                      <option value="h">horas antes</option>
                      <option value="d">dias antes</option>
                    </select>
                  </div>
                )}
                {reminderMinutes ? (
                  <p className="text-[10.5px] text-slate-500">
                    O cliente recebe o aviso {reminderLabel(reminderMinutes)} antes, com o imóvel e o horário.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {properties && (
            <label className="block space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Observações</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Opcional" className={agendaInputClass} />
            </label>
          )}

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {error}
                {/plano Pro/.test(error) && (
                  <>
                    {' '}
                    <Link href="/assinatura" className="font-bold underline">
                      Ver planos
                    </Link>
                  </>
                )}
              </span>
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="btn-domu-primary text-xs py-2 px-5 flex items-center gap-2 disabled:opacity-50">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar visita
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
