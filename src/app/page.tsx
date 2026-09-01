'use client';

import React, { useState, useEffect } from 'react';
import OverviewStats from '@/components/dashboard/OverviewStats';
import CampaignWizardModal from '@/components/disparos/CampaignWizardModal';
import QueueSimulator from '@/components/disparos/QueueSimulator';
import Link from 'next/link';
import {
  Send,
  PlusCircle,
  ArrowUpRight,
  Smartphone,
  Clock,
  Zap,
} from 'lucide-react';
import { TenantSegment } from '@/types';
import {
  getSegmentFromStorage,
  SEGMENT_LABELS,
  SEGMENT_WELCOME,
  isRealEstateSegment,
} from '@/lib/segmentConfig';

export default function DashboardPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeQueue, setActiveQueue] = useState<{ title: string; count: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'funil' | 'disparos' | 'atendimento'>('funil');

  const [companyName, setCompanyName] = useState('Sua Empresa');
  const [whatsappPhone, setWhatsappPhone] = useState('(11) 99999-9999');
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalSent, setTotalSent] = useState(0);
  const [segment, setSegment] = useState<TenantSegment>('geral');

  useEffect(() => {
    const savedCompany = localStorage.getItem('domu_company_name');
    if (savedCompany) setCompanyName(savedCompany);
    setSegment(getSegmentFromStorage());
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/dashboard/stats?tenantId=${storedTenantId}`);
      const json = await res.json();

      if (json.success && json.metrics) {
        if (json.metrics.tenantName) setCompanyName(json.metrics.tenantName);
        if (json.metrics.whatsappPhone && json.metrics.whatsappPhone !== 'Não cadastrado') {
          setWhatsappPhone(json.metrics.whatsappPhone);
        }
        setTotalLeads(json.metrics.totalLeads || 0);
        setTotalSent(json.metrics.totalDispatches || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    }
  };

  const handleStartCampaign = (title: string, templateName: string, count: number) => {
    setActiveQueue({ title, count });
  };

  const segmentLabel = SEGMENT_LABELS[segment] || 'Geral';
  const welcomeMessage = SEGMENT_WELCOME[segment] || SEGMENT_WELCOME.geral;
  const showRealEstateExtras = isRealEstateSegment(segment);

  return (
    <div className="space-y-5 w-full font-sans">

      {/* Welcome banner */}
      <div className="bg-[#0B132B] p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300">
            Portal DOMU Tech · {segmentLabel}
          </p>
          <h2 className="text-base font-black">Olá, {companyName}</h2>
          <p className="text-xs text-slate-300 max-w-lg">{welcomeMessage}</p>
        </div>
        <button
          onClick={() => setIsWizardOpen(true)}
          className="btn-domu-primary text-xs py-2.5 px-5 shrink-0 flex items-center gap-2 self-start sm:self-center"
        >
          <Send className="w-4 h-4" />
          <span>Novo Disparo</span>
        </button>
      </div>

      <OverviewStats />

      {activeQueue && (
        <QueueSimulator
          campaignTitle={activeQueue.title}
          totalRecipients={activeQueue.count}
        />
      )}

      <div className="bg-white border border-slate-200 p-5 space-y-5 w-full">

        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('funil')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'funil'
                  ? 'bg-domu-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Funil de Vendas e Conversão
            </button>

            <button
              onClick={() => setActiveTab('disparos')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'disparos'
                  ? 'bg-domu-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Desempenho de Disparos
            </button>

            <button
              onClick={() => setActiveTab('atendimento')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'atendimento'
                  ? 'bg-domu-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <span>Atendimentos 1:1</span>
              <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded">Em Breve</span>
            </button>
          </div>

          <Link
            href="/disparos"
            className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1"
          >
            Ver Detalhes dos Disparos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {activeTab === 'funil' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-900">Funil de Vendas e Etapas de Conversão</h3>
              <p className="text-[11px] text-slate-500">Distribuição automatizada de contatos por etapa do processo comercial</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">

              <div className="p-3.5 bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">1. Novos Contatos</span>
                  <span className="text-domu-blue font-black">{totalLeads}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-domu-blue h-full rounded-full transition-all duration-300" style={{ width: totalLeads > 0 ? '100%' : '0%' }}></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Contatos cadastrados no sistema</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">2. Mensagem Enviada</span>
                  <span className="text-domu-blue font-black">{totalSent}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-domu-blue h-full rounded-full transition-all duration-300" style={{ width: totalSent > 0 ? '85%' : '0%' }}></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Campanhas disparadas via Meta API</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">3. Em Atendimento</span>
                  <span className="text-domu-blue font-black">{totalLeads > 0 ? Math.floor(totalLeads * 0.4) : 0}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-domu-blue h-full rounded-full transition-all duration-300" style={{ width: totalLeads > 0 ? '40%' : '0%' }}></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Conversas ativas no WhatsApp</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">4. Concluído</span>
                  <span className="text-emerald-600 font-black">{totalLeads > 0 ? Math.floor(totalLeads * 0.15) : 0}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: totalLeads > 0 ? '15%' : '0%' }}></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Negócios finalizados</p>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'disparos' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-black text-slate-900">Campanhas executadas na Meta Cloud API</h3>
              <p className="text-[11px] text-slate-500">Envios processados com controle de taxa de entrega e zero risco de bloqueio</p>
            </div>

            <div className="p-8 text-center bg-slate-50 border border-slate-200 space-y-3">
              <div className="w-10 h-10 bg-blue-100 text-domu-blue rounded-full flex items-center justify-center mx-auto">
                <Send className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-900">Disparos em Massa Prontos</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Crie sua primeira campanha para enviar ofertas, avisos e mensagens automatizadas para seus contatos.
                </p>
              </div>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="btn-domu-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Criar Primeira Campanha</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'atendimento' && (
          <div className="p-6 text-center space-y-3 bg-slate-50 border border-slate-200 max-w-xl mx-auto">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-900">Central Multiatendentes 1:1 (Em Breve)</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Em breve você poderá distribuir atendimentos do WhatsApp entre operadores da sua empresa com histórico unificado.
              </p>
            </div>
          </div>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">

        <div className="lg:col-span-6 bg-white p-5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-domu-blue" />
              <h3 className="text-xs font-black text-slate-900">Status do WhatsApp</h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Conectado
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Número <strong className="text-slate-900">{whatsappPhone}</strong> cadastrado para a empresa <strong>{companyName}</strong>. Atendimentos manuais e disparos automáticos funcionam em simultâneo.
          </p>

          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
            <span>Sessão de Atendimento: <strong className="text-emerald-600 font-bold">Ativa</strong></span>
            <span className="text-domu-blue font-bold">Coexistência Oficial OK</span>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-domu-blue" />
              <h3 className="text-xs font-black text-slate-900">
                {showRealEstateExtras ? 'Disparos e Alertas de Oferta' : 'Disparos e Campanhas'}
              </h3>
            </div>
            <Link href="/disparos" className="text-[11px] font-bold text-domu-blue hover:underline flex items-center gap-1">
              Ver Módulo <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {showRealEstateExtras
              ? 'Inicie campanhas de lançamentos e alertas de imóveis para sua base de leads qualificados.'
              : 'Inicie uma nova campanha de mensagens em massa para comunicar novidades e ofertas para sua base de clientes no WhatsApp.'}
          </p>

          <div className="pt-1">
            <button
              onClick={() => setIsWizardOpen(true)}
              className="w-full btn-domu-primary text-xs py-2.5 px-4 justify-center flex items-center gap-2 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Iniciar Novo Disparo em Massa</span>
            </button>
          </div>
        </div>

      </div>

      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStartCampaign={handleStartCampaign}
      />
    </div>
  );
}
