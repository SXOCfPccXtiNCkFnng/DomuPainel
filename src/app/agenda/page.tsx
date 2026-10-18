'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bot, CalendarDays, Clock, Wrench } from 'lucide-react';
import AppointmentsTab from '@/components/agenda/AppointmentsTab';
import ServicesTab from '@/components/agenda/ServicesTab';
import HoursTab from '@/components/agenda/HoursTab';
import AssistantTab from '@/components/agenda/AssistantTab';
import type { ServiceItem } from '@/lib/scheduling';

type Tab = 'agenda' | 'servicos' | 'horarios' | 'assistente';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'agenda', label: 'Agenda', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'servicos', label: 'Serviços', icon: <Wrench className="w-4 h-4" /> },
  { id: 'horarios', label: 'Horários', icon: <Clock className="w-4 h-4" /> },
  { id: 'assistente', label: 'Assistente IA', icon: <Bot className="w-4 h-4" /> },
];

export default function AgendaPage() {
  const [tab, setTab] = useState<Tab>('agenda');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduling/services');
      const json = await res.json();
      if (!json.success) {
        setLoadError(json.error || 'Não foi possível carregar os serviços.');
        return;
      }
      setServices(json.services || []);
      setLoadError(null);
    } catch {
      setLoadError('Não foi possível carregar os serviços.');
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex gap-1 bg-white border border-slate-200/80 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              tab === t.id ? 'bg-blue-50 text-domu-blue' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
        </p>
      )}

      {tab === 'agenda' && <AppointmentsTab services={services} onGoToServices={() => setTab('servicos')} />}
      {tab === 'servicos' && <ServicesTab services={services} onChanged={loadServices} />}
      {tab === 'horarios' && <HoursTab />}
      {tab === 'assistente' && <AssistantTab services={services} />}
    </div>
  );
}
