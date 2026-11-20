'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Brain, ChevronDown } from 'lucide-react';
import { ProLockedCard } from '@/components/shared/SalesIntelligencePanel';
import AskAiBox from '@/components/shared/AskAiBox';
import type { RealEstateDemand } from '@/lib/realEstateDemand';

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-[11px] text-slate-400">Sem dados ainda.</p>;
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]" title={`${r.label}: ${r.count}`}>
          <span className="w-28 truncate text-slate-600 font-bold">{r.label}</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-domu-blue rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-6 text-right text-slate-500">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

/** O que os clientes procuram e o que falta no catálogo (Pro e Enterprise). */
export default function DemandIntelligence() {
  const [state, setState] = useState<{ locked: boolean; demand: RealEstateDemand | null } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch('/api/real-estate/insights')
      .then((r) => r.json())
      .then((json) => json.success && setState({ locked: Boolean(json.locked), demand: json.demand ?? null }))
      .catch(() => undefined);
  }, []);

  if (!state) return null;
  if (state.locked) {
    return (
      <ProLockedCard
        title="Inteligência de demanda é do plano Pro"
        text="No Pro a Domu mostra o que seus clientes mais procuram (tipo, bairro e faixa de valor), em que dia e horário eles chegam e quais imóveis estão faltando no catálogo, com o que fazer em cada caso."
      />
    );
  }
  const d = state.demand;
  if (!d || d.leads === 0) return <AskAiBox />;

  return (
    <>
    <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <span>
          <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-domu-blue" /> Inteligência de demanda
          </span>
          <span className="block text-[11px] text-slate-500">
            Últimos 90 dias: {d.leads} contatos, {d.withProfile} com o que procuram registrado.
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          {d.insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {d.insights.map((i) => (
                <div key={i.title} className="border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-black text-slate-900">{i.title}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{i.text}</p>
                  {i.href && i.action && (
                    <Link href={i.href} className="text-[11px] font-bold text-domu-blue flex items-center gap-1 hover:underline">
                      {i.action} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-slate-900">Tipo mais procurado</h3>
              <Bars rows={d.types} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-slate-900">Bairros</h3>
              <Bars rows={d.regions} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-slate-900">Faixa de valor</h3>
              <Bars rows={d.budgets} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-slate-900">Dia em que chegam</h3>
              <Bars rows={d.weekdays} />
              {d.peakHour != null && <p className="text-[10.5px] text-slate-400">Pico às {d.peakHour}h.</p>}
            </div>
          </div>
        </>
      )}
    </section>
    <AskAiBox />
    </>
  );
}
