'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Bell, CalendarCheck, CalendarClock, Clock, Loader2, Lock, MessageCircle } from 'lucide-react';
import VisitScheduleModal, { type VisitScheduleValues } from '@/components/imoveis/VisitScheduleModal';
import { reminderLabel } from '@/lib/visitReminderRules';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatPhoneBR } from '@/lib/validators';
import { VISIT_STATUS_LABELS, type VisitRequest, type VisitStatus } from '@/lib/realEstate';

const STATUS_STYLES: Record<VisitStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DONE: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-400 border-slate-200',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export default function VisitasPage() {
  const [visits, setVisits] = useState<VisitRequest[]>([]);
  const [planAllows, setPlanAllows] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleAvailable, setScheduleAvailable] = useState(true);
  // Visita sendo confirmada ou remarcada (abre a janela de data e aviso).
  const [scheduling, setScheduling] = useState<VisitRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/real-estate/visits');
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar as visitas.');
        return;
      }
      setVisits(json.visits || []);
      setPlanAllows(json.planAllowsVisits !== false);
      setScheduleAvailable(json.scheduleAvailable !== false);
      setError(null);
    } catch {
      setError('Não foi possível carregar as visitas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load);

  const setStatus = async (visit: VisitRequest, status: VisitStatus) => {
    const res = await fetch('/api/real-estate/visits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: visit.id, status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setError(json.error || 'Não foi possível atualizar a visita.');
      return;
    }
    setVisits((list) => list.map((v) => (v.id === visit.id ? { ...v, status } : v)));
  };

  /** Confirma (ou remarca) com a data combinada e o aviso ao cliente. */
  const confirmWithSchedule = async (values: VisitScheduleValues): Promise<string | null> => {
    if (!scheduling) return null;
    const res = await fetch('/api/real-estate/visits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scheduling.id, status: 'CONFIRMED', ...values }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.success) return json.error || 'Não foi possível salvar a visita.';
    await load();
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando visitas...
      </div>
    );
  }

  const pending = visits.filter((v) => v.status === 'PENDING');
  const others = visits.filter((v) => v.status !== 'PENDING');

  return (
    <div className="space-y-4 w-full font-sans">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {!planAllows && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-domu-blue flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-black text-slate-900">Visitas pela atendente é do plano Pro</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              No seu plano a atendente faz o primeiro atendimento: entende o que o cliente procura, mostra os imóveis e
              passa para você. No Pro ela conduz a conversa até a visita: tira as dúvidas sobre o imóvel, pega o dia e
              o horário que o cliente prefere e deixa o pedido aqui para você só confirmar.
            </p>
          </div>
          <Link href="/assinatura" className="btn-domu-primary text-xs py-2 px-4 shrink-0 w-fit">
            Ver plano Pro
          </Link>
        </section>
      )}

      {planAllows && visits.length === 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center space-y-2 max-w-xl mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-domu-blue flex items-center justify-center">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-black text-slate-900">Nenhum pedido de visita ainda</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Quando um cliente quiser visitar um imóvel, a atendente anota o dia e o horário que ele prefere e o pedido
            aparece aqui. Você confirma com o cliente pelo WhatsApp e marca como confirmada.
          </p>
        </div>
      )}

      {[
        { title: 'Aguardando sua confirmação', list: pending },
        { title: 'Histórico', list: others },
      ]
        .filter((g) => g.list.length > 0)
        .map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="text-xs font-black text-slate-900">
              {group.title} ({group.list.length})
            </h2>
            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
              {group.list.map((v) => (
                <div key={v.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {v.customer_name}
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLES[v.status]}`}>
                        {VISIT_STATUS_LABELS[v.status]}
                      </span>
                    </p>
                    <p className="text-xs text-slate-700 font-semibold">{v.property_label || 'Imóvel removido'}</p>
                    {v.scheduled_at ? (
                      <p className="text-[11px] text-slate-800 font-bold flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" /> Marcada para {dateFormatter.format(new Date(v.scheduled_at))}
                      </p>
                    ) : v.preferred_time ? (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Prefere: {v.preferred_time}
                      </p>
                    ) : null}
                    {v.scheduled_at && v.status === 'CONFIRMED' && (
                      <p
                        className={`text-[11px] flex items-center gap-1 ${
                          v.reminder_status === 'FAILED' ? 'text-red-600' : v.reminder_status === 'SENT' ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5" />
                        {v.reminder_minutes == null
                          ? 'Sem aviso ao cliente'
                          : v.reminder_note || `Aviso ao cliente ${reminderLabel(v.reminder_minutes)} antes`}
                      </p>
                    )}
                    {v.notes && <p className="text-[11px] text-slate-500">{v.notes}</p>}
                    <p className="text-[10.5px] text-slate-400">
                      {formatPhoneBR(v.customer_phone) || v.customer_phone} · pedido em {dateFormatter.format(new Date(v.created_at))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <a
                      href={`https://wa.me/${v.customer_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                    {v.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => (scheduleAvailable && planAllows ? setScheduling(v) : setStatus(v, 'CONFIRMED'))}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-domu-blue text-white hover:bg-blue-700"
                      >
                        Confirmar
                      </button>
                    )}
                    {v.status === 'CONFIRMED' && scheduleAvailable && planAllows && (
                      <button
                        type="button"
                        onClick={() => setScheduling(v)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-domu-blue hover:bg-blue-50"
                      >
                        {v.scheduled_at ? 'Remarcar' : 'Definir horário'}
                      </button>
                    )}
                    {v.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => setStatus(v, 'DONE')}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-800"
                      >
                        Realizada
                      </button>
                    )}
                    {(v.status === 'PENDING' || v.status === 'CONFIRMED') && (
                      <button
                        type="button"
                        onClick={() => setStatus(v, 'CANCELLED')}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

      <VisitScheduleModal
        isOpen={Boolean(scheduling)}
        title={scheduling?.status === 'CONFIRMED' ? 'Remarcar visita' : 'Confirmar visita'}
        customerName={scheduling?.customer_name || ''}
        hint={scheduling?.preferred_time}
        initialScheduledAt={scheduling?.scheduled_at}
        initialReminderMinutes={scheduling?.scheduled_at ? scheduling.reminder_minutes : undefined}
        onClose={() => setScheduling(null)}
        onSubmit={confirmWithSchedule}
      />
    </div>
  );
}
