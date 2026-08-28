'use client';

import React from 'react';
import { Send, Eye, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import { mockCampaigns } from '@/lib/mockData';
import Link from 'next/link';

export default function RecentCampaigns() {
  return (
    <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4 w-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-domu-blue" />
            Histórico de Campanhas de Disparo
          </h3>
          <p className="text-[11px] text-slate-500">Envios em massa via Meta Cloud API Oficial com acompanhamento em tempo real</p>
        </div>
        <Link 
          href="/disparos" 
          className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1"
        >
          Ver Todas ({mockCampaigns.length}) <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Campaigns Table / Cards */}
      <div className="space-y-2.5">
        {mockCampaigns.map((campaign) => {
          const percentageSent = Math.round((campaign.sentCount / campaign.totalRecipients) * 100);
          const percentageRead = Math.round((campaign.readCount / campaign.sentCount) * 100) || 0;

          return (
            <div 
              key={campaign.id}
              className="p-3.5 rounded bg-slate-50/60 border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              {/* Campaign Info */}
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase ${
                    campaign.status === 'SENDING' 
                      ? 'bg-blue-100 text-domu-blue border border-blue-200' 
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {campaign.status === 'SENDING' ? 'Disparando Fila' : 'Concluído'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Template: {campaign.templateName}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{campaign.title}</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>Criado: {campaign.createdAt}</span>
                  <span>•</span>
                  <span>{campaign.totalRecipients} contatos</span>
                </p>
              </div>

              {/* Progress & Metrics */}
              <div className="flex items-center gap-6 self-end sm:self-center">
                <div className="w-36 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Progresso</span>
                    <span className="text-slate-900">{percentageSent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        campaign.status === 'SENDING' ? 'bg-domu-blue' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percentageSent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-right border-l border-slate-200 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Taxa de Leitura</span>
                  <span className="text-xs font-black text-slate-900 flex items-center justify-end gap-1">
                    <Eye className="w-3.5 h-3.5 text-domu-blue" />
                    {percentageRead}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
