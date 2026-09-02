'use client';

import React, { useState, useEffect } from 'react';
import OverviewStats from '@/components/dashboard/OverviewStats';
import CampaignWizardModal, {
  CampaignStartPayload,
} from '@/components/disparos/CampaignWizardModal';
import CampaignProgress from '@/components/disparos/CampaignProgress';
import Link from 'next/link';
import {
  Send,
  PlusCircle,
  Smartphone,
  Users,
  MessageSquareReply,
  Tags,
} from 'lucide-react';
import { TenantSegment } from '@/types';
import {
  getSegmentFromStorage,
  SEGMENT_WELCOME,
  isRealEstateSegment,
} from '@/lib/segmentConfig';
import { getAuthItem } from '@/lib/authStorage';

export default function DashboardPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [userName, setUserName] = useState('Gestor');
  const [companyName, setCompanyName] = useState('Sua Empresa');
  const [whatsappPhone, setWhatsappPhone] = useState('(11) 99999-9999');
  const [segment, setSegment] = useState<TenantSegment>('geral');
  const [roiMetrics, setRoiMetrics] = useState([
    { label: 'Contatos atingidos', value: '0', hint: 'Entregas no período' },
    { label: 'Taxa de resposta', value: '0%', hint: 'Quem engajou' },
    { label: 'Leads qualificados', value: '0', hint: 'No funil ativo' },
    { label: 'Visitas agendadas', value: '0', hint: 'ROI do corretor' },
  ]);

  useEffect(() => {
    const savedName = getAuthItem('domu_user_name');
    const savedCompany = getAuthItem('domu_company_name');
    if (savedName) setUserName(savedName);
    if (savedCompany && savedCompany !== 'Domu' && savedCompany !== 'Empresa DOMU') {
      setCompanyName(savedCompany);
    }
    setSegment(getSegmentFromStorage());
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(`/api/dashboard/stats?tenantId=${storedTenantId}&period=30d`);
      const json = await res.json();

      if (json.success && json.metrics) {
        if (json.metrics.tenantName && json.metrics.tenantName !== 'Domu') {
          setCompanyName(json.metrics.tenantName);
        }
        if (json.metrics.whatsappPhone && json.metrics.whatsappPhone !== 'Não cadastrado') {
          setWhatsappPhone(json.metrics.whatsappPhone);
        }
        setRoiMetrics([
          {
            label: 'Contatos atingidos',
            value: String(json.metrics.atingidos ?? 0),
            hint: 'Entregas no período',
          },
          {
            label: 'Taxa de resposta',
            value: `${json.metrics.taxaResposta ?? 0}%`,
            hint: 'Quem engajou',
          },
          {
            label: 'Leads qualificados',
            value: String(json.metrics.leadsQualificados ?? 0),
            hint: 'No funil ativo',
          },
          {
            label: 'Visitas agendadas',
            value: String(json.metrics.visitasAgendadas ?? 0),
            hint: 'ROI do corretor',
          },
        ]);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    }
  };

  const handleStartCampaign = (payload: CampaignStartPayload) => {
    if (payload.campaignId) setActiveCampaignId(payload.campaignId);
  };

  const welcomeMessage = SEGMENT_WELCOME[segment] || SEGMENT_WELCOME.geral;
  const isRealEstate = isRealEstateSegment(segment);

  return (
    <div className="space-y-5 w-full font-sans">
      <div className="bg-[#0B132B] p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300">
            Plano Starter
          </p>
          <h2 className="text-lg font-bold">Olá, {userName}</h2>
          <p className="text-sm text-slate-300 max-w-xl leading-relaxed">{welcomeMessage}</p>
        </div>
        <button
          onClick={() => setIsWizardOpen(true)}
          className="btn-domu-primary text-sm py-2.5 px-5 shrink-0 flex items-center gap-2 self-start sm:self-center"
        >
          <Send className="w-4 h-4" />
          <span>Novo Disparo</span>
        </button>
      </div>

      {/* ROI metrics — Starter promise */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Indicadores de ROI
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Retorno das campanhas: quem foi atingido, respondeu e avançou no funil
            </p>
          </div>
          <Link href="/metricas" className="text-[11px] font-semibold text-domu-blue hover:underline">
            Ver painel de ROI →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {roiMetrics.map((metric) => (
            <div key={metric.label} className="bg-white border border-slate-200 p-4 space-y-1">
              <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{metric.value}</p>
              <p className="text-[11px] text-slate-400">{metric.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <OverviewStats />

      {activeCampaignId && (
        <CampaignProgress
          campaignId={activeCampaignId}
          onClose={() => setActiveCampaignId(null)}
        />
      )}

      {/* Quick actions + WhatsApp */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        <div className="lg:col-span-6 bg-white p-5 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Users className="w-4 h-4 text-domu-blue" />
            <h3 className="text-sm font-bold text-slate-900">Atalhos do dia a dia</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {isRealEstate && (
              <Link
                href="/imoveis"
                className="px-3 py-2.5 border border-slate-200 text-sm font-semibold text-slate-700 hover:border-domu-blue hover:text-domu-blue flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Cadastrar imóvel
              </Link>
            )}
            <Link
              href="/contatos"
              className="px-3 py-2.5 border border-slate-200 text-sm font-semibold text-slate-700 hover:border-domu-blue hover:text-domu-blue flex items-center gap-2"
            >
              <Tags className="w-4 h-4" />
              Importar contatos
            </Link>
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="px-3 py-2.5 border border-slate-200 text-sm font-semibold text-slate-700 hover:border-domu-blue hover:text-domu-blue flex items-center gap-2 text-left"
            >
              <Send className="w-4 h-4" />
              Disparar campanha
            </button>
            <Link
              href="/atendimento"
              className="px-3 py-2.5 border border-slate-200 text-sm font-semibold text-slate-700 hover:border-domu-blue hover:text-domu-blue flex items-center gap-2"
            >
              <MessageSquareReply className="w-4 h-4" />
              Ver quem respondeu
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-domu-blue" />
              <h3 className="text-sm font-bold text-slate-900">Status do WhatsApp</h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5">
              Conectado
            </span>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Número <strong className="text-slate-900">{whatsappPhone}</strong> · empresa{' '}
            <strong>{companyName}</strong>. Limite Starter: 1.500/mês e 200/dia (DOMU), sujeito à Meta.
          </p>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
            <span>
              Sessão: <strong className="text-emerald-600">Ativa</strong>
            </span>
            <Link href="/configuracoes" className="text-domu-blue font-semibold hover:underline">
              Configurações
            </Link>
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
