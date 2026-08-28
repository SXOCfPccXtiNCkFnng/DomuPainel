'use client';

import React, { useState } from 'react';
import OverviewStats from '@/components/dashboard/OverviewStats';
import CampaignWizardModal from '@/components/disparos/CampaignWizardModal';
import QueueSimulator from '@/components/disparos/QueueSimulator';
import Link from 'next/link';
import { 
  Send, 
  MessageSquare, 
  PlusCircle, 
  ArrowUpRight, 
  CheckCircle2, 
  Smartphone, 
  TrendingUp, 
  Building2, 
  Users, 
  Filter, 
  BarChart3,
  Clock
} from 'lucide-react';
import { mockCampaigns, mockProperties, mockTenants } from '@/lib/mockData';

export default function DashboardPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeQueue, setActiveQueue] = useState<{ title: string; count: number } | null>(null);
  const [selectedPropertyTitle, setSelectedPropertyTitle] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'funil' | 'disparos' | 'atendimento'>('funil');

  const tenant = mockTenants[0];

  const handleOpenWizardForProperty = (propertyTitle: string) => {
    setSelectedPropertyTitle(propertyTitle);
    setIsWizardOpen(true);
  };

  const handleStartCampaign = (title: string, templateName: string, count: number) => {
    setActiveQueue({ title, count });
  };

  return (
    <div className="space-y-5 w-full">
      
      {/* Metrics Row & Period Selector */}
      <OverviewStats />

      {/* Live Queue Simulator (if active) */}
      {activeQueue && (
        <QueueSimulator 
          campaignTitle={activeQueue.title} 
          totalRecipients={activeQueue.count} 
        />
      )}

      {/* Main Clean Card Container */}
      <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-5 w-full">
        
        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('funil')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                activeTab === 'funil' 
                  ? 'bg-domu-blue text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Funil de Vendas Imobiliárias
            </button>

            <button
              onClick={() => setActiveTab('disparos')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                activeTab === 'disparos' 
                  ? 'bg-domu-blue text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Desempenho de Disparos
            </button>

            <button
              onClick={() => setActiveTab('atendimento')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 border border-transparent ${
                activeTab === 'atendimento' 
                  ? 'bg-domu-blue text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <span>Atendimentos 1:1</span>
              <span className="text-[8.5px] px-1 py-0.2 bg-amber-100 text-amber-800 font-extrabold rounded">Em Breve</span>
            </button>
          </div>

          <Link
            href="/disparos"
            className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1"
          >
            Ver Detalhes do Módulo <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Tab 1: Funil de Vendas Imobiliárias */}
        {activeTab === 'funil' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">Funil de Vendas Imobiliárias & Atendimento</h3>
              <p className="text-[11px] text-slate-500">Distribuição automatizada de leads por etapa do processo de compra</p>
            </div>

            {/* Visual Clean Funnel Bar Chart */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              
              {/* Stage 1 */}
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">1. Novo Contato</span>
                  <span className="text-domu-blue font-black">312</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-domu-blue h-full w-[100%] rounded-full"></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Capturados via formulário e WhatsApp</p>
              </div>

              {/* Stage 2 */}
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">2. Alerta Enviado</span>
                  <span className="text-domu-blue font-black">298</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-domu-blue h-full w-[88%] rounded-full"></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Notificação de imóvel entregue</p>
              </div>

              {/* Stage 3 */}
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">3. Agendou Visita</span>
                  <span className="text-domu-blue font-black">84</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-domu-blue h-full w-[45%] rounded-full"></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Visitas presenciais agendadas</p>
              </div>

              {/* Stage 4 */}
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">4. Concluído / Fechado</span>
                  <span className="text-emerald-600 font-black">42</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[25%] rounded-full"></div>
                </div>
                <p className="text-[10.5px] text-slate-500">Propostas aprovadas</p>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Desempenho de Disparos */}
        {activeTab === 'disparos' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">Campanhas Recentes executadas na Meta Cloud API</h3>
              <p className="text-[11px] text-slate-500">Envios processados com controle de taxa de entrega e zero risco de bloqueio</p>
            </div>

            <div className="divide-y divide-slate-100">
              {mockCampaigns.map((camp) => (
                <div key={camp.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-domu-blue inline-block">
                      {camp.status}
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs">{camp.title}</h4>
                    <p className="text-[10.5px] text-slate-500">{camp.totalRecipients} destinatários • Template: {camp.templateName}</p>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-domu-blue text-xs">{camp.sentCount}</span> / {camp.totalRecipients}
                    <span className="text-[10px] text-slate-400 block font-normal">mensagens entregues</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Atendimento 1:1 */}
        {activeTab === 'atendimento' && (
          <div className="p-6 text-center space-y-3 bg-slate-50 rounded border border-slate-200/80 max-w-xl mx-auto">
            <div className="w-10 h-10 rounded bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold text-slate-900">Central de Atendimento Multiatendente 1:1 (Em Breve)</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Em breve você poderá distribuir conversas do WhatsApp em tempo real entre sua equipe de corretores, com histórico unificado e respostas rápidas.
              </p>
            </div>
            <Link
              href="/atendimento"
              className="btn-domu-primary text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
            >
              <span>Visualizar Preview da Caixa de Entrada</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

      </div>

      {/* Secondary Clean Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        
        {/* Coexistence Clean Status */}
        <div className="lg:col-span-6 bg-white p-4 rounded-md border border-slate-200/80 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-domu-blue" />
              <h3 className="text-xs font-extrabold text-slate-900">Status da Coexistência WhatsApp</h3>
            </div>
            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.2 rounded">
              Conectado
            </span>
          </div>

          <p className="text-[11.5px] text-slate-600 leading-relaxed">
            Número <strong>{tenant.whatsappNumber}</strong> ativo no celular e na Meta Cloud API. Atendimentos manuais e disparos automáticos funcionam em simultâneo.
          </p>

          <div className="pt-1.5 flex items-center justify-between text-[10.5px] text-slate-500 border-t border-slate-100">
            <span>Último check-in no celular: <strong className="text-domu-blue font-bold">há 3 dias</strong></span>
            <span className="text-emerald-600 font-extrabold">Sessão Ativa por mais 11 dias</span>
          </div>
        </div>

        {/* Quick Property Alert Action */}
        <div className="lg:col-span-6 bg-white p-4 rounded-md border border-slate-200/80 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-domu-blue" />
              <h3 className="text-xs font-extrabold text-slate-900">Gatilhos de Notificação Imobiliária</h3>
            </div>
            <Link href="/imoveis" className="text-[11px] font-bold text-domu-blue hover:underline flex items-center gap-1">
              Catálogo ({mockProperties.length}) <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <p className="text-[11.5px] text-slate-600 leading-relaxed">
            Selecione um imóvel do catálogo para disparar alertas personalizados para os leads compatíveis no WhatsApp.
          </p>

          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={() => handleOpenWizardForProperty('Residencial Horizon Tower')}
              className="btn-domu-primary text-xs py-1.5 px-3 flex-1 justify-center"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Disparar Alerta Horizon Tower</span>
            </button>
          </div>
        </div>

      </div>

      {/* Campaign Wizard Modal */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStartCampaign={handleStartCampaign}
        initialPropertyTitle={selectedPropertyTitle}
      />
    </div>
  );
}
