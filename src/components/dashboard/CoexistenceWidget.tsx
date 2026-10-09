'use client';

import React, { useState, useEffect } from 'react';
import { Gauge, Smartphone, Zap } from 'lucide-react';
import Disclosure from '@/components/shared/Disclosure';

const QUALITY: Record<string, { label: string; className: string }> = {
  GREEN: { label: 'Alta', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  YELLOW: { label: 'Média', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  RED: { label: 'Baixa', className: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Status do número conectado: o essencial à vista (número, qualidade, limite,
 * celular sincronizado) e as explicações da Meta recolhidas.
 */
export default function CoexistenceWidget({
  onStatusChange,
}: {
  /** Avisa o pai se está conectado ou não, pra ele decidir se mostra o seletor de modo. */
  onStatusChange?: (isConnected: boolean) => void;
}) {
  const [phone, setPhone] = useState<string>('');
  const [qualityRating, setQualityRating] = useState<string | null>(null);
  const [dailyLimitTier, setDailyLimitTier] = useState<string | null>(null);
  const [numericLimit, setNumericLimit] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);

  useEffect(() => {
    const savedPhone = localStorage.getItem('domu_whatsapp_phone');
    setPhone(savedPhone && savedPhone !== 'Não cadastrado' ? savedPhone : '');
    fetchMetaStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMetaStats = async () => {
    try {
      const res = await fetch('/api/whatsapp/stats');
      const json = await res.json();

      if (json.success && json.stats) {
        const connected = Boolean(json.stats.isConnected);
        setIsConnected(connected);
        onStatusChange?.(connected);
        setDailyLimitTier(json.stats.formattedTierLabel);
        setQualityRating(json.stats.qualityRating);
        setNumericLimit(json.stats.numericLimit);
        if (json.stats.displayPhoneNumber) setPhone(json.stats.displayPhoneNumber);
      }
    } catch (err) {
      console.error('Erro ao buscar dados oficiais da Meta API:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  if (isLoadingMeta) {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 animate-pulse">
        <div className="h-4 w-48 bg-slate-100 rounded" />
        <div className="h-4 w-72 bg-slate-100 rounded" />
      </div>
    );
  }

  // Não conectado: o pai (configuracoes/page.tsx) mostra o seletor de modo
  // (Coexistência vs API Direta) em vez desse widget.
  if (!isConnected) return null;

  const quality = qualityRating ? QUALITY[qualityRating] : null;

  return (
    <div className="space-y-3">
      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp conectado
            </p>
            <p className="text-lg font-black text-slate-900 font-mono mt-0.5">{phone || '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                quality?.className || 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              Qualidade: {quality?.label || qualityRating || '—'}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-blue-50 text-domu-blue border-blue-200">
              <Zap className="w-3.5 h-3.5" />
              Limite: {dailyLimitTier || '—'}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200">
              <Smartphone className="w-3.5 h-3.5" />
              Celular sincronizado
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          O app no celular continua funcionando junto com a plataforma. Abra o WhatsApp no celular pelo menos a cada{' '}
          <strong className="text-slate-700">14 dias</strong> para manter a conexão ativa.
        </p>
      </div>

      <Disclosure title="Entender qualidade e limite diário" subtitle="O que a Meta avalia e quantas mensagens você pode enviar por dia">
        <div className="space-y-3 text-[11.5px] text-slate-600 leading-relaxed">
          <p>
            Seu número está no limite de <strong>{dailyLimitTier}</strong> — até{' '}
            {(numericLimit ?? 0).toLocaleString('pt-BR')} contatos novos por 24h. A plataforma respeita esse limite
            automaticamente nos envios.
          </p>
          <p>
            A Meta avalia a qualidade do número pelos últimos 7 dias de envios (mensagens lidas, respostas, bloqueios e
            denúncias):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-emerald-700 block mb-0.5">Alta (verde)</span>
              Os clientes recebem bem as mensagens.
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-amber-700 block mb-0.5">Média (amarela)</span>
              Houve denúncias ou bloqueios recentes. Pause envios frios e revise o texto.
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-rose-700 block mb-0.5">Baixa (vermelha)</span>
              Muitas denúncias. Risco de o limite cair ou o número ser bloqueado.
            </div>
          </div>
        </div>
      </Disclosure>
    </div>
  );
}
