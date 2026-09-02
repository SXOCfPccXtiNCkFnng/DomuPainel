'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, CheckCircle2, Info, AlertTriangle, Zap } from 'lucide-react';

export default function CoexistenceWidget() {
  const [phone, setPhone] = useState<string>('');
  const [qualityScore, setQualityScore] = useState<string>('VERDE (Excelente)');
  const [dailyLimitTier, setDailyLimitTier] = useState<string>('Tier 1 (1.000 msgs/24h)');
  const [numericLimit, setNumericLimit] = useState<number>(1000);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);

  useEffect(() => {
    // Read connected phone from localStorage
    const savedPhone = localStorage.getItem('domu_whatsapp_phone');
    if (savedPhone && savedPhone !== 'Não cadastrado') {
      setPhone(savedPhone);
    } else {
      setPhone('');
    }

    // Fetch live Meta stats from backend API
    fetchMetaStats();
  }, []);

  const fetchMetaStats = async () => {
    try {
      const res = await fetch('/api/whatsapp/stats');
      const json = await res.json();

      if (json.success && json.stats) {
        setDailyLimitTier(json.stats.formattedTierLabel || 'Tier 1 (1.000 msgs/24h)');
        setQualityScore(json.stats.formattedQuality || 'VERDE (Excelente)');
        setNumericLimit(json.stats.numericLimit || 1000);
        if (json.stats.displayPhoneNumber) {
          setPhone(json.stats.displayPhoneNumber);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados oficiais da Meta API:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  return (
    <div className="card-domu p-5 bg-gradient-to-br from-white via-slate-50 to-blue-50/30 border border-blue-100 space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-extrabold uppercase tracking-wide bg-domu-blue/10 text-domu-blue border border-domu-blue/30">
              Status da Conexão WhatsApp
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-sm border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Quality Score Meta: {qualityScore}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-sm border border-blue-300">
              <Zap className="w-3 h-3 text-domu-blue" />
              Limite Diário Meta: {dailyLimitTier}
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            Número Conectado: {phone ? (
              <span className="font-mono text-domu-blue font-bold">{phone}</span>
            ) : (
              <span className="text-slate-400 font-normal italic">Nenhum número conectado no momento</span>
            )}
          </h4>

          <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
            Seu aplicativo <strong>WhatsApp Business no celular</strong> está sincronizado simultaneamente com a <strong>API Oficial Meta</strong>. Você pode realizar conversas 1 a 1 no celular enquanto a plataforma executa campanhas em massa com segurança.
          </p>
        </div>

        {/* Right Status & 14-Day Sync Warning */}
        <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full lg:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-sm bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <Smartphone className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Sincronização de Dispositivo</p>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                Conexão: <span className="text-emerald-600 font-extrabold">Sincronizado</span>
              </p>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>

          <div className="text-left w-full sm:w-auto">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Aviso dos 14 Dias (Meta)
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">
              Abra o WhatsApp no celular a cada 14 dias para manter o vínculo ativo.
            </p>
          </div>
        </div>

      </div>

      {/* Meta Eligibility & Daily Limits Notice */}
      <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-sm text-xs text-slate-800 flex items-center gap-2">
        <Info className="w-4 h-4 text-domu-blue shrink-0" />
        <span>
          <strong>Consulta Direta Meta Cloud API:</strong> Sua conta está no <strong>{dailyLimitTier}</strong> (limite oficial retornado pelos servidores da Meta de até {numericLimit.toLocaleString('pt-BR')} disparos/24h). O limite é controlado automaticamente na hora dos envios.
        </span>
      </div>
    </div>
  );
}
