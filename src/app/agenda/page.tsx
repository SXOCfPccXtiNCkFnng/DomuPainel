'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import AppointmentsTab from '@/components/agenda/AppointmentsTab';
import type { ServiceItem } from '@/lib/scheduling';

export default function AgendaPage() {
  const router = useRouter();
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
      {loadError && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
        </p>
      )}
      <AppointmentsTab services={services} onGoToServices={() => router.push('/servicos')} />
    </div>
  );
}
