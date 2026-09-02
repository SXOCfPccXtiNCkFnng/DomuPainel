'use client';

import React, { useState } from 'react';
import ImoveisDestaque from '@/components/dashboard/ImoveisDestaque';
import CampaignWizardModal, {
  CampaignStartPayload,
} from '@/components/disparos/CampaignWizardModal';
import CampaignProgress from '@/components/disparos/CampaignProgress';
import NovoImovelModal from '@/components/imoveis/NovoImovelModal';
import { Building2, Users, Send, MapPin, Tag, Plus, CheckCircle2, MessageSquare } from 'lucide-react';
import { mockProperties, mockLeads } from '@/lib/mockData';
import { Property } from '@/types';
import { getAuthItem } from '@/lib/authStorage';

export default function ImoveisPage() {
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPropertyTitle, setSelectedPropertyTitle] = useState<string | undefined>(undefined);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const handleOpenWizard = (propertyTitle: string, propertyId?: string) => {
    setSelectedPropertyTitle(propertyTitle);
    setSelectedPropertyId(propertyId);
    setIsWizardOpen(true);
  };

  const handleAddProperty = async (newProp: Property) => {
    setProperties([newProp, ...properties]);
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          property: {
            title: newProp.title,
            type: newProp.type,
            price: newProp.price,
            neighborhood: newProp.neighborhood,
            city: newProp.city,
            bedrooms: newProp.bedrooms,
            bathrooms: newProp.bathrooms,
            area_sqm: newProp.areaSqMeter,
            image_url: newProp.imageUrl,
            code: newProp.code,
          },
        }),
      });
    } catch (err) {
      console.error('Erro ao persistir imóvel:', err);
    }
    setSuccessNotification(`Imóvel "${newProp.title}" cadastrado com sucesso e já disponível no painel!`);
    setTimeout(() => setSuccessNotification(null), 5000);
  };

  const handleStartCampaign = (payload: CampaignStartPayload) => {
    if (payload.campaignId) setActiveCampaignId(payload.campaignId);
  };

  return (
    <div className="space-y-6 w-full">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200">
              Setor Imobiliário
            </span>
            <span className="text-xs text-slate-500 font-medium">Catálogo de Lançamentos e Automação de Leads</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Gestão de Imóveis e Automações de Alertas
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-domu-primary text-xs py-2 px-4 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Imóvel</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successNotification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-md flex items-center justify-between text-xs font-bold shadow-xs animate-in fade-in duration-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successNotification}
          </span>
          <button 
            onClick={() => setSuccessNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}

      {activeCampaignId && (
        <CampaignProgress
          campaignId={activeCampaignId}
          onClose={() => setActiveCampaignId(null)}
        />
      )}

      {/* Property Showcase with Custom State */}
      <ImoveisDestaque 
        properties={properties}
        onTriggerPropertyDispatch={handleOpenWizard}
        onOpenAddPropertyModal={() => setIsAddModalOpen(true)}
      />

      {/* Active Real Estate Leads Table */}
      <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-domu-blue" />
              Leads Imobiliários Ativos no Funil
            </h3>
            <p className="text-[11px] text-slate-500">Leads qualificados via WhatsApp Bot com interesse em imóveis do catálogo</p>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10.5px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-2.5 px-3">Nome do Lead</th>
                <th className="py-2.5 px-3">WhatsApp</th>
                <th className="py-2.5 px-3">Interesse / Orçamento</th>
                <th className="py-2.5 px-3">Status do Funil</th>
                <th className="py-2.5 px-3 text-right">Ação Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {mockLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900 text-xs">{lead.name}</p>
                    <p className="text-[10.5px] text-slate-400">{lead.email}</p>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-domu-blue font-bold">
                    {lead.phone}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-800 text-xs">{lead.interestPropertyType}</p>
                    <p className="text-[10.5px] text-slate-400">Até R$ {lead.budgetMax.toLocaleString('pt-BR')}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-blue-50 text-domu-blue border border-blue-100">
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-domu-blue" />
                      <span>Enviar Mensagem</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Novo Imovel Modal */}
      <NovoImovelModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProperty={handleAddProperty}
      />

      {/* Campaign Wizard Modal */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStartCampaign={handleStartCampaign}
        initialPropertyTitle={selectedPropertyTitle}
        initialPropertyId={selectedPropertyId}
      />

    </div>
  );
}
