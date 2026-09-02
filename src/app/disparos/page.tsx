'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Send,
  Plus,
  RefreshCw,
  Users,
  Calendar,
  CheckCheck,
  Eye,
  Building2,
} from 'lucide-react';
import CampaignWizardModal, {
  CampaignStartPayload,
} from '@/components/disparos/CampaignWizardModal';
import CampaignProgress from '@/components/disparos/CampaignProgress';
import { getAuthItem } from '@/lib/authStorage';

export default function DisparosPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
    if (typeof window !== 'undefined') {
      const id = new URLSearchParams(window.location.search).get('campaign');
      if (id) setActiveCampaignId(id);
    }
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(`/api/campaigns?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.campaigns || []);
      }
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCampaign = async (payload: CampaignStartPayload) => {
    if (payload.campaignId) setActiveCampaignId(payload.campaignId);
    await fetchCampaigns();
  };

  const statusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'AGENDADO' || s === 'SCHEDULED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          AGENDADO
        </span>
      );
    }
    if (s === 'RUNNING') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
          ENVIANDO
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
          FALHA
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
        {s || 'CONCLUÍDO'}
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              Motor de Envio Meta API
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Status enviado · entregue · lido
            </span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Disparos de Mensagens em Massa
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/contatos"
            className="px-3.5 py-2 bg-white text-slate-700 font-extrabold border border-slate-300 rounded-xl text-xs hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Users className="w-4 h-4 text-domu-blue" />
            <span>Gerenciar Contatos</span>
          </Link>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      {activeCampaignId && (
        <CampaignProgress
          campaignId={activeCampaignId}
          onClose={() => setActiveCampaignId(null)}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900">
            Histórico de Disparos Executados e Agendados
          </h3>
          <button
            onClick={fetchCampaigns}
            className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
            Lista
          </button>
        </div>

        {campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-y border-slate-200">
                  <th className="py-2.5 px-3">Campanha</th>
                  <th className="py-2.5 px-3">Imóvel</th>
                  <th className="py-2.5 px-3">Template</th>
                  <th className="py-2.5 px-3">Destinatários</th>
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1">
                      <Send className="w-3 h-3" /> Enviado
                    </span>
                  </th>
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Entregue
                    </span>
                  </th>
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Lido
                    </span>
                  </th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {campaigns.map((camp) => (
                  <tr
                    key={camp.id}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      activeCampaignId === camp.id ? 'bg-blue-50/60' : ''
                    }`}
                    onClick={() => setActiveCampaignId(camp.id)}
                  >
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div>{camp.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {camp.scheduledAt
                          ? `Agendado: ${new Date(camp.scheduledAt).toLocaleString('pt-BR')}`
                          : camp.createdAt
                            ? new Date(camp.createdAt).toLocaleDateString('pt-BR')
                            : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {camp.propertyTitle ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-domu-blue" />
                          {camp.propertyTitle}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{camp.templateName}</td>
                    <td className="py-3 px-3 font-bold">{camp.totalLeads || camp.sentCount}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{camp.sentCount ?? 0}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">
                      {camp.deliveredCount ?? 0}
                    </td>
                    <td className="py-3 px-3 font-bold text-domu-blue">{camp.readCount ?? 0}</td>
                    <td className="py-3 px-3">{statusBadge(camp.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="w-12 h-12 bg-blue-100 text-domu-blue rounded-full flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900">Nenhum disparo realizado ainda</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Importe contatos, escolha o segmento e dispare. Os status Meta (enviado / entregue /
                lido) aparecem aqui via webhook.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/contatos"
                className="px-4 py-2 bg-white text-slate-700 font-extrabold border border-slate-300 rounded-xl text-xs hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
              >
                <Users className="w-4 h-4 text-domu-blue" />
                <span>Importar Contatos</span>
              </Link>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Campanha</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStartCampaign={handleStartCampaign}
      />
    </div>
  );
}
