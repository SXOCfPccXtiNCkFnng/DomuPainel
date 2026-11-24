'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { getSegmentFromStorage, isPizzeriaSegment, isRealEstateSegment } from '@/lib/segmentConfig';
import { isSchedulingSegment } from '@/lib/schedulingVerticals';

/**
 * Faixa para quem pulou a conexão do WhatsApp no onboarding: lembra de
 * conectar e oferece testar a atendente no simulador enquanto isso.
 * Lê só o que está salvo (sem consultar a Meta).
 */
export default function WhatsAppPendingBanner() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [hasAssistant, setHasAssistant] = useState(false);

  useEffect(() => {
    const segment = getSegmentFromStorage();
    setHasAssistant(isSchedulingSegment(segment) || isRealEstateSegment(segment) || isPizzeriaSegment(segment));
    fetch('/api/settings/whatsapp')
      .then((r) => r.json())
      .then((json) => setPending(Boolean(json?.success) && !json.settings?.phoneNumberId))
      .catch(() => {});
  }, []);

  if (!pending || pathname === '/configuracoes') return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <MessageCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-amber-900">Seu WhatsApp ainda não está conectado</p>
          <p className="text-[12px] text-amber-800">
            {hasAssistant
              ? 'A atendente e as campanhas começam a funcionar depois da conexão. Enquanto isso, teste a atendente aqui no painel.'
              : 'As campanhas começam a funcionar depois da conexão, que leva poucos minutos.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {hasAssistant && pathname !== '/atendente' && (
          <Link href="/atendente" className="text-xs font-bold px-3 py-2 rounded-xl border border-amber-300 text-amber-900 bg-white hover:bg-amber-100">
            Testar a atendente
          </Link>
        )}
        <Link href="/configuracoes?secao=meta" className="btn-domu-primary text-xs py-2 px-4">
          Conectar agora
        </Link>
      </div>
    </div>
  );
}
