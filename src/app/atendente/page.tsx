'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AssistantTab from '@/components/agenda/AssistantTab';
import type { ServiceItem } from '@/lib/scheduling';
import { getSegmentFromStorage, isPizzeriaSegment, isRealEstateSegment } from '@/lib/segmentConfig';

/**
 * Atendente IA. Lava rápido: os serviços e horários ficam em /servicos;
 * imobiliário: o catálogo fica em /imoveis.
 */
export default function AtendentePage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [realEstate, setRealEstate] = useState<boolean | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduling/services');
      const json = await res.json();
      if (json.success) setServices(json.services || []);
    } catch {
      /* a atendente carrega o resto sozinha */
    }
  }, []);

  useEffect(() => {
    // Imobiliário e pizzaria não usam serviços de agenda (catálogo em /imoveis, cardápio em /cardapio).
    const segment = getSegmentFromStorage();
    const isRealEstate = isRealEstateSegment(segment) || isPizzeriaSegment(segment);
    setRealEstate(isRealEstate);
    if (isRealEstate) return;
    // Links antigos (/atendente?aba=servicos) vão para a página nova.
    const aba = new URLSearchParams(window.location.search).get('aba');
    if (aba === 'servicos' || aba === 'horarios') {
      router.replace(`/servicos?aba=${aba}`);
      return;
    }
    loadServices();
  }, [loadServices, router]);

  if (realEstate === null) return null;

  return (
    <div className="space-y-4 w-full font-sans">
      <AssistantTab services={services} onGoToServices={realEstate ? undefined : () => router.push('/servicos')} />
    </div>
  );
}
