'use client';

import React, { useEffect, useState } from 'react';
import { Send, Eye, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  templateName?: string;
  createdAt?: string;
  totalLeads?: number;
  sentCount?: number;
  readCount?: number;
};

export default function RecentCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/campaigns');
        const json = await res.json();
        if (json.success) {
          setCampaigns((json.campaigns || []).slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4 w-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-domu-blue" />
            Histórico de Campanhas de Disparo
          </h3>
          <p className="text-[11px] text-slate-500">
            Envios em massa via Meta Cloud API com acompanhamento em tempo real
          </p>
        </div>
        <Link
          href="/disparos"
          className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1"
        >
          Ver todas {campaigns.length > 0 ? `(${campaigns.length}+)` : ''}{' '}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {loading && (
          <p className="text-xs text-slate-400 py-6 text-center">Carregando campanhas…</p>
        )}
        {!loading && campaigns.length === 0 && (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nenhuma campanha ainda.{' '}
            <Link href="/disparos" className="text-domu-blue font-semibold hover:underline">
              Criar disparo
            </Link>
          </p>
        )}
        {campaigns.map((campaign) => {
          const total = campaign.totalLeads || 0;
          const sent = campaign.sentCount || 0;
          const read = campaign.readCount || 0;
          const percentageSent = total > 0 ? Math.round((sent / total) * 100) : 0;
          const percentageRead = sent > 0 ? Math.round((read / sent) * 100) : 0;
          const status = (campaign.status || '').toUpperCase();
          const running = status === 'RUNNING' || status === 'SCHEDULED';

          return (
            <div
              key={campaign.id}
              className="p-3.5 rounded bg-slate-50/60 border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase ${
                      running
                        ? 'bg-blue-100 text-domu-blue border border-blue-200'
                        : status === 'FAILED'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {status === 'SCHEDULED'
                      ? 'Agendado'
                      : status === 'RUNNING'
                        ? 'Enviando'
                        : status === 'FAILED'
                          ? 'Falhou'
                          : 'Concluído'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Template: {campaign.templateName || '—'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{campaign.name}</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>
                    {campaign.createdAt
                      ? new Date(campaign.createdAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                  <span>•</span>
                  <span>{total} contatos</span>
                </p>
              </div>

              <div className="flex items-center gap-6 self-end sm:self-center">
                <div className="w-36 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Progresso</span>
                    <span className="text-slate-900">{percentageSent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        running ? 'bg-domu-blue' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percentageSent}%` }}
                    />
                  </div>
                </div>

                <div className="text-right border-l border-slate-200 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Taxa de leitura
                  </span>
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
