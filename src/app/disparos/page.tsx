'use client';

import React, { useState } from 'react';
import CampaignWizardModal from '@/components/disparos/CampaignWizardModal';
import QueueSimulator from '@/components/disparos/QueueSimulator';
import { 
  Send, 
  PlusCircle, 
  Search, 
  Eye, 
  ArrowUpRight,
  Zap,
  Filter
} from 'lucide-react';
import { mockCampaigns } from '@/lib/mockData';

export default function DisparosPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'sending' | 'completed'>('all');
  const [activeQueue, setActiveQueue] = useState<{ title: string; count: number } | null>({
    title: mockCampaigns[0].title,
    count: mockCampaigns[0].totalRecipients
  });

  const filteredCampaigns = mockCampaigns.filter(c => {
    if (selectedFilter === 'sending') return c.status === 'SENDING';
    if (selectedFilter === 'completed') return c.status === 'COMPLETED';
    return true;
  });

  const handleStartCampaign = (title: string, templateName: string, count: number) => {
    setActiveQueue({ title, count });
  };

  return (
    <div className="space-y-6 w-full">
      
      {/* Clean Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 w-full">
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Disparos em Massa
          </h1>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="btn-domu-primary text-xs py-2 px-4 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Nova Campanha</span>
        </button>
      </div>

      {/* Active Sending Banner (Only when queue is active) */}
      {activeQueue && (
        <QueueSimulator 
          campaignTitle={activeQueue.title} 
          totalRecipients={activeQueue.count} 
        />
      )}

      {/* Single Main Card — Full Width Clean Campaigns Table */}
      <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4 w-full">
        
        {/* Table Filter & Search Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 w-full">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-md text-xs font-semibold">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1 rounded transition-all ${
                selectedFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Todas ({mockCampaigns.length})
            </button>

            <button
              onClick={() => setSelectedFilter('sending')}
              className={`px-3 py-1 rounded transition-all ${
                selectedFilter === 'sending' ? 'bg-domu-blue text-white font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Em Andamento
            </button>

            <button
              onClick={() => setSelectedFilter('completed')}
              className={`px-3 py-1 rounded transition-all ${
                selectedFilter === 'completed' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Concluídas
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar campanha..." 
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-domu-blue w-56 font-medium"
            />
          </div>
        </div>

        {/* Clean Campaigns Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10.5px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-3">Campanha</th>
                <th className="py-3 px-3">Template Meta</th>
                <th className="py-3 px-3">Destinatários</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Progresso</th>
                <th className="py-3 px-3 text-right">Taxa de Leitura</th>
                <th className="py-3 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCampaigns.map((camp) => {
                const percentageSent = Math.round((camp.sentCount / camp.totalRecipients) * 100);
                const percentageRead = Math.round((camp.readCount / camp.sentCount) * 100) || 0;

                return (
                  <tr key={camp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3">
                      <p className="font-bold text-slate-900 text-xs">{camp.title}</p>
                      <p className="text-[10.5px] text-slate-400">Criado em {camp.createdAt}</p>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {camp.templateName}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-slate-800">
                      {camp.totalRecipients} contatos
                    </td>

                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] font-black uppercase tracking-wide ${
                        camp.status === 'SENDING' 
                          ? 'text-domu-blue' 
                          : 'text-emerald-600'
                      }`}>
                        {camp.status === 'SENDING' ? 'Disparando' : 'Concluído'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="w-32 space-y-1">
                        <div className="flex justify-between text-[10.5px] font-bold">
                          <span className="text-slate-500">{camp.sentCount}/{camp.totalRecipients}</span>
                          <span className="text-domu-blue">{percentageSent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${camp.status === 'SENDING' ? 'bg-domu-blue' : 'bg-emerald-500'}`}
                            style={{ width: `${percentageSent}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-black text-slate-900">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Eye className="w-3.5 h-3.5 text-domu-blue" />
                        {percentageRead}%
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <button 
                        onClick={() => handleStartCampaign(camp.title, camp.templateName, camp.totalRecipients)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Disparar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Campaign Wizard Modal */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStartCampaign={handleStartCampaign}
      />

    </div>
  );
}
