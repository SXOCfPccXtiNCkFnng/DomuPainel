'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, Building2, Loader2, MessageCircle, Search, UserRound } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import { formatPhoneBR } from '@/lib/validators';
import { interestSummary, LEAD_STAGE_LABELS, LEAD_STAGES, type LeadStage } from '@/lib/realEstate';

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  status: string | null;
  region: string | null;
  budget_max: number | null;
  interest_purpose: string | null;
  interest_property_type: string | null;
  bedrooms_min: number | null;
  ai_summary: string | null;
  interest_property: string | null;
  last_contact_at: string | null;
  updated_at: string | null;
  assistant_paused_until: string | null;
};

const STAGE_STYLES: Record<LeadStage, string> = {
  NOVO: 'bg-slate-100 text-slate-600 border-slate-200',
  EM_ATENDIMENTO: 'bg-blue-50 text-domu-blue border-blue-200',
  VISITA_AGENDADA: 'bg-violet-50 text-violet-700 border-violet-200',
  PROPOSTA: 'bg-amber-50 text-amber-700 border-amber-200',
  FECHADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PERDIDO: 'bg-slate-50 text-slate-400 border-slate-200',
};

function stageOf(status: string | null): LeadStage {
  return LEAD_STAGES.includes(status as LeadStage) ? (status as LeadStage) : 'NOVO';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<LeadStage | ''>('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/real-estate/leads');
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar os leads.');
        return;
      }
      setLeads(json.leads || []);
      setError(null);
    } catch {
      setError('Não foi possível carregar os leads.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load);

  const counts = useMemo(() => {
    const map = new Map<LeadStage, number>();
    for (const l of leads) map.set(stageOf(l.status), (map.get(stageOf(l.status)) || 0) + 1);
    return map;
  }, [leads]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return leads.filter((l) => {
      if (stage && stageOf(l.status) !== stage) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q) || (digits.length >= 4 && l.phone.includes(digits));
    });
  }, [leads, stage, search]);

  const setLeadStage = async (lead: LeadRow, next: LeadStage) => {
    const previous = lead.status;
    setLeads((list) => list.map((l) => (l.id === lead.id ? { ...l, status: next } : l)));
    const res = await fetch('/api/real-estate/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setLeads((list) => list.map((l) => (l.id === lead.id ? { ...l, status: previous } : l)));
      setError(json.error || 'Não foi possível mudar a etapa.');
    }
  };

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStage('')}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
            stage === '' ? 'bg-domu-blue text-white border-domu-blue' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          Todos ({leads.length})
        </button>
        {LEAD_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
              stage === s ? 'bg-domu-blue text-white border-domu-blue' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {LEAD_STAGE_LABELS[s]} ({counts.get(s) || 0})
          </button>
        ))}
      </div>

      <label className="relative block max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className={`${agendaInputClass} pl-9`}
          aria-label="Buscar lead"
        />
      </label>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando leads...
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center space-y-2 max-w-xl mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-domu-blue flex items-center justify-center">
            <UserRound className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-black text-slate-900">Nenhum lead ainda</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Quem mandar mensagem no seu WhatsApp aparece aqui. Com a atendente ligada, ela já anota o que cada cliente
            procura: comprar ou alugar, tipo, região, faixa de valor e quartos.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-slate-500 bg-white border border-slate-200/80 rounded-2xl p-6 text-center">
          Nenhum lead nesse filtro.
        </p>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
          {visible.map((l) => {
            const current = stageOf(l.status);
            const interest = interestSummary(l);
            const handedOff = l.assistant_paused_until && new Date(l.assistant_paused_until) > new Date();
            return (
              <div key={l.id} className="p-4 flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {l.name}
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STAGE_STYLES[current]}`}>
                      {LEAD_STAGE_LABELS[current]}
                    </span>
                    {handedOff && (
                      <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                        Aguardando corretor
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatPhoneBR(l.phone) || l.phone}
                    {l.updated_at ? ` · ${timeAgo(l.updated_at)}` : ''}
                  </p>
                  {interest && <p className="text-xs text-slate-700 font-semibold">{interest}</p>}
                  {l.interest_property && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 shrink-0" /> {l.interest_property}
                    </p>
                  )}
                  {l.ai_summary && (
                    <p className="text-[11px] text-slate-500 flex items-start gap-1 leading-relaxed">
                      <Bot className="w-3.5 h-3.5 shrink-0 mt-0.5 text-domu-blue" /> {l.ai_summary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 md:flex-col md:items-end shrink-0">
                  <select
                    value={current}
                    onChange={(e) => setLeadStage(l, e.target.value as LeadStage)}
                    className={`${agendaInputClass} w-44`}
                    aria-label={`Etapa de ${l.name}`}
                  >
                    {LEAD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <a
                    href={`https://wa.me/${l.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
