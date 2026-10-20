'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarPlus,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  X,
} from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useSchedulingCopy } from '@/hooks/useSchedulingCopy';
import { formatPhoneBR } from '@/lib/validators';
import {
  addDaysToKey,
  APPOINTMENT_STATUS_LABELS,
  brtDateKey,
  brtMinutesOfDay,
  brtToUtc,
  formatDuration,
  formatMinutes,
  formatPrice,
  NOTES_MAX,
  parseTime,
  VEHICLE_MAX,
  type Appointment,
  type AppointmentStatus,
  type ServiceItem,
} from '@/lib/scheduling';
import { agendaInputClass } from './agendaStyles';

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  CONFIRMED: 'bg-blue-50 text-domu-blue border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-50 text-slate-500 border-slate-200',
  NO_SHOW: 'bg-amber-50 text-amber-800 border-amber-200',
};

type FormState = {
  serviceId: string;
  slot: string;
  customTime: string;
  customerName: string;
  customerPhone: string;
  vehicle: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  serviceId: '',
  slot: '',
  customTime: '',
  customerName: '',
  customerPhone: '',
  vehicle: '',
  notes: '',
};

function timeOf(iso: string): string {
  return formatMinutes(brtMinutesOfDay(new Date(iso)));
}

function formatDayTitle(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default function AppointmentsTab({
  services,
  onGoToServices,
}: {
  services: ServiceItem[];
  onGoToServices: () => void;
}) {
  const { copy } = useSchedulingCopy();
  const todayKey = brtDateKey(new Date());
  const [date, setDate] = useState(todayKey);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const selectedService = activeServices.find((s) => s.id === form.serviceId) || null;

  const load = useCallback(async (day: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    try {
      const res = await fetch(`/api/scheduling/appointments?date=${day}`);
      const json = await res.json();
      if (!json.success) {
        if (!opts?.silent) setError(json.error || 'Não foi possível carregar a agenda.');
        return;
      }
      setAppointments(json.appointments || []);
      if (!opts?.silent) setError(null);
    } catch {
      if (!opts?.silent) setError('Não foi possível carregar a agenda.');
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [load, date]);

  // Agendamentos feitos pelo WhatsApp aparecem sem recarregar a página.
  useAutoRefresh(() => load(date, { silent: true }));

  const loadSlots = useCallback(async (day: string, serviceId: string) => {
    if (!serviceId) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/scheduling/availability?date=${day}&serviceId=${encodeURIComponent(serviceId)}`);
      const json = await res.json();
      setSlots(json.success ? json.slots || [] : []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showForm) loadSlots(date, form.serviceId);
  }, [showForm, date, form.serviceId, loadSlots]);

  const openForm = () => {
    setForm({ ...EMPTY_FORM, serviceId: activeServices[0]?.id || '' });
    setShowForm(true);
    setError(null);
    setNotice(null);
  };

  const startsAt = useMemo(() => {
    if (form.slot) return form.slot;
    const minutes = parseTime(form.customTime);
    return minutes == null ? '' : brtToUtc(date, minutes).toISOString();
  }, [form.slot, form.customTime, date]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/scheduling/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: form.serviceId,
          startsAt,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          vehicle: form.vehicle,
          notes: form.notes,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível agendar.');
        loadSlots(date, form.serviceId);
        return;
      }
      setShowForm(false);
      setNotice(`Agendado: ${json.appointment.customer_name} às ${timeOf(json.appointment.starts_at)}.`);
      load(date);
    } catch {
      setError('Não foi possível agendar.');
    } finally {
      setIsSaving(false);
    }
  };

  const setStatus = async (id: string, status: AppointmentStatus) => {
    setError(null);
    setNotice(null);
    const res = await fetch('/api/scheduling/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.success) setError(json.error || 'Não foi possível atualizar o agendamento.');
    load(date, { silent: true });
  };

  const active = appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED');
  const expectedRevenue = active.reduce((sum, a) => sum + (a.price || 0), 0);
  const canSave =
    Boolean(form.serviceId && startsAt && form.customerName.trim().length >= 2 && form.customerPhone.trim()) &&
    !isSaving;

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((d) => addDaysToKey(d, -1))}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${agendaInputClass} w-40`}
            aria-label="Dia da agenda"
          />
          <button
            type="button"
            onClick={() => setDate((d) => addDaysToKey(d, 1))}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {date !== todayKey && (
            <button
              type="button"
              onClick={() => setDate(todayKey)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-domu-blue hover:bg-blue-50"
            >
              Hoje
            </button>
          )}
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={activeServices.length ? openForm : onGoToServices}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <CalendarPlus className="w-4 h-4" />
            {activeServices.length ? 'Novo agendamento' : 'Cadastre um serviço primeiro'}
          </button>
        )}
      </div>

      {showForm && (
        <section className="bg-white rounded-2xl border border-domu-blue/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">
              Novo agendamento · <span className="capitalize">{formatDayTitle(date)}</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-600">Serviço</span>
            <select
              value={form.serviceId}
              onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value, slot: '' }))}
              className={agendaInputClass}
            >
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.duration_minutes)} · {formatPrice(s.price)}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="block text-[11px] font-bold text-slate-600">Horários livres</span>
            {slotsLoading ? (
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando horários...
              </p>
            ) : slots.length ? (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, slot: f.slot === iso ? '' : iso, customTime: '' }))}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                      form.slot === iso
                        ? 'bg-domu-blue text-white border-domu-blue'
                        : 'border-slate-200 text-slate-700 hover:border-domu-blue hover:text-domu-blue'
                    }`}
                  >
                    {timeOf(iso)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nenhum horário livre neste dia para esse serviço.</p>
            )}
            <label className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              Ou encaixe em outro horário:
              <input
                type="time"
                value={form.customTime}
                onChange={(e) => setForm((f) => ({ ...f, customTime: e.target.value, slot: '' }))}
                className={`${agendaInputClass} w-28`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Nome do cliente</span>
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className={agendaInputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">WhatsApp</span>
              <input
                value={form.customerPhone}
                inputMode="numeric"
                maxLength={15}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: formatPhoneBR(e.target.value) }))}
                placeholder="(11) 99999-9999"
                className={agendaInputClass}
              />
            </label>
            {copy.item && (
              <label className="space-y-1.5">
                <span className="block text-[11px] font-bold text-slate-600">Veículo</span>
                <input
                  value={form.vehicle}
                  maxLength={VEHICLE_MAX}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
                  placeholder="Ex.: Onix prata · ABC1D23"
                  className={agendaInputClass}
                />
              </label>
            )}
            <label className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Observações</span>
              <input
                value={form.notes}
                maxLength={NOTES_MAX}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Opcional"
                className={agendaInputClass}
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-slate-500">
              {selectedService && startsAt
                ? `${timeOf(startsAt)} até ${timeOf(
                    new Date(new Date(startsAt).getTime() + selectedService.duration_minutes * 60000).toISOString()
                  )}`
                : 'Escolha um horário.'}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar agendamento
            </button>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-900 capitalize">{formatDayTitle(date)}</h2>
          <p className="text-[11px] text-slate-500">
            {active.length} {active.length === 1 ? 'agendamento' : 'agendamentos'} · previsto {formatPrice(expectedRevenue)}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando agenda...
          </div>
        ) : appointments.length === 0 ? (
          <p className="text-xs text-slate-500 p-5">Nenhum agendamento neste dia.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {appointments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="text-center shrink-0 w-14">
                    <p className="text-sm font-black text-slate-900">{timeOf(a.starts_at)}</p>
                    <p className="text-[10px] text-slate-400">até {timeOf(a.ends_at)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {a.customer_name}
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLES[a.status]}`}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </span>
                      {a.source === 'WHATSAPP' && (
                        <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 inline-flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> Pelo WhatsApp
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {a.service_name} · {formatPrice(a.price)} · {formatPhoneBR(a.customer_phone)}
                    </p>
                    {(a.vehicle || a.notes) && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        {a.vehicle && (
                          <>
                            <Car className="w-3 h-3" /> {a.vehicle}
                          </>
                        )}
                        {a.vehicle && a.notes ? ' · ' : ''}
                        {a.notes}
                      </p>
                    )}
                    {a.reminder_note && (
                      <p
                        className={`text-[11px] flex items-center gap-1.5 ${
                          a.reminder_status === 'SENT'
                            ? 'text-emerald-600'
                            : a.reminder_status === 'FAILED'
                              ? 'text-red-600'
                              : 'text-slate-500'
                        }`}
                      >
                        <Bell className="w-3 h-3" /> {a.reminder_note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {a.status === 'CONFIRMED' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatus(a.id, 'COMPLETED')}
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        Concluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(a.id, 'NO_SHOW')}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Faltou
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(a.id, 'CANCELLED')}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-red-600 hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : a.status !== 'COMPLETED' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(a.id, 'CONFIRMED')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-domu-blue hover:bg-blue-50"
                    >
                      Reativar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
