'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Lightbulb, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { TIP_ACTIONS, summaryHeadline, type InsightTip, type WeeklyMetrics } from '@/lib/weeklyInsightsRules';
import SalesIntelligencePanel, { ProLockedCard } from '@/components/shared/SalesIntelligencePanel';
import AskAiBox from '@/components/shared/AskAiBox';

type Insight = {
  id: string;
  week_start: string;
  week_end: string;
  metrics: WeeklyMetrics;
  tips: InsightTip[];
  ai_used: boolean;
  created_at: string;
};
type WeekRef = { id: string; week_start: string; week_end: string };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const day = (key: string) => key.split('-').reverse().slice(0, 2).join('/');

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-1">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="text-xl font-black tracking-tight text-slate-900">{value}</p>
      {hint && (
        <p className={`text-[10.5px] ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-400'}`}>{hint}</p>
      )}
    </div>
  );
}

function change(current: number, previous: number): { hint: string; tone?: 'good' | 'bad' } {
  if (!previous) return { hint: 'sem semana anterior para comparar' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { hint: 'igual à semana anterior' };
  return { hint: `${pct > 0 ? '+' : ''}${pct}% que a semana anterior`, tone: pct > 0 ? 'good' : 'bad' };
}

export default function DicasPage() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [weeks, setWeeks] = useState<WeekRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const load = useCallback(async (id?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/insights${id ? `?id=${id}` : ''}`);
      const json = await res.json();
      if (!json.success) {
        setError(res.status === 403 ? 'Só administradores veem as dicas da semana.' : json.error || 'Não foi possível carregar.');
        return;
      }
      setLocked(Boolean(json.locked));
      setInsight(json.insight);
      setWeeks(json.weeks || []);
      setError(json.available === false ? json.error : null);
    } catch {
      setError('Não foi possível carregar as dicas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setIsGenerating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/insights', { method: 'POST' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível gerar as dicas.');
        return;
      }
      setError(null);
      if (json.reused) setNotice('Suas dicas foram geradas há pouco. Estas são as mais recentes.');
      await load(json.insight.id);
    } catch {
      setError('Não foi possível gerar as dicas.');
    } finally {
      setIsGenerating(false);
    }
  };

  const m = insight?.metrics;
  const orders = m?.kind === 'pedidos';
  const maxDay = m ? Math.max(1, ...m.weekdays.map((d) => d.count)) : 1;

  if (locked) {
    return (
      <div className="space-y-4 w-full font-sans">
        <ProLockedCard
          title="Dicas da semana e inteligência de vendas são do plano Pro"
          text="Todo domingo a Domu analisa a semana e mostra o que mais vendeu em cada dia, o que sai junto, quem parou de comprar e 3 dicas escritas pela IA com o que fazer para vender mais. Chega no painel, no e-mail e no WhatsApp."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {weeks.length > 1 && (
            <select
              value={insight?.id || ''}
              onChange={(e) => load(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700"
              aria-label="Semana"
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  Semana de {day(w.week_start)} a {day(w.week_end)}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isGenerating}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-domu-blue hover:text-domu-blue flex items-center gap-1.5 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isGenerating ? 'Analisando sua semana...' : 'Gerar dicas agora'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {notice && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">{notice}</p>}

      <AskAiBox />

      {isLoading && !insight ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando dicas...
        </div>
      ) : !insight || !m ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-3">
          <Lightbulb className="w-8 h-8 text-domu-blue mx-auto" />
          <h2 className="text-sm font-black text-slate-900">Suas dicas chegam todo domingo à noite</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            A Domu analisa os agendamentos ou pedidos, o financeiro, as conversas e a atendente, e te mostra onde dá para vender mais e perder menos clientes.
            Se quiser ver agora, clique em &quot;Gerar dicas agora&quot;.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-domu-blue to-blue-700 text-white rounded-2xl p-5 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-100">
              Semana de {day(insight.week_start)} a {day(insight.week_end)}
            </p>
            <p className="text-lg font-black leading-snug">{summaryHeadline(m)}</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-domu-blue" /> Dicas para a próxima semana
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {insight.tips.map((tip, i) => {
                const action = TIP_ACTIONS[tip.action];
                return (
                  <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2">
                    <p className="text-sm font-black text-slate-900">{tip.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed flex-1">{tip.text}</p>
                    {action && (
                      <Link href={action.href} className="text-xs font-bold text-domu-blue flex items-center gap-1 hover:underline">
                        {action.label} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {m.intelligence && <SalesIntelligencePanel data={m.intelligence} period="últimas 4 semanas" />}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Faturamento" value={brl(m.revenue)} {...change(m.revenue, m.prevRevenue)} />
            <Stat label={orders ? 'Pedidos' : 'Atendimentos'} value={String(m.done)} {...change(m.done, m.prevDone)} />
            <Stat label="Ticket médio" value={brl(m.averageTicket)} />
            <Stat
              label={orders ? 'Cancelados' : 'Faltas e cancelamentos'}
              value={String(m.noShows + m.cancelled)}
              hint={m.lostRevenue ? `${brl(m.lostRevenue)} que não entraram` : undefined}
              tone={m.lostRevenue ? 'bad' : undefined}
            />
            {!orders && <Stat label="Já marcado (próximos 7 dias)" value={String(m.upcoming)} hint={m.upcomingRevenue ? brl(m.upcomingRevenue) : undefined} />}
            <Stat label={orders ? 'Pedidos pela atendente' : 'Agendados pela atendente'} value={String(m.bookedByAssistant)} />
            <Stat label="Clientes novos" value={String(m.newCustomers)} hint={`${m.returningCustomers} já eram clientes`} />
            <Stat label="Lucro da semana" value={brl(m.profit)} hint={m.expenses ? `Gastos: ${brl(m.expenses)}` : 'Lance os gastos no Financeiro'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900">Movimento por dia (últimas 4 semanas)</h3>
              <div className="space-y-1.5">
                {m.weekdays.map((d) => (
                  <div key={d.weekday} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-slate-500 font-bold">{d.label.slice(0, 3)}</span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-domu-blue rounded-full" style={{ width: `${(d.count / maxDay) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right text-slate-600">{d.open ? `${d.count} ${orders ? 'ped.' : 'atend.'}` : 'fechado'}</span>
                  </div>
                ))}
              </div>
              {m.peakHours.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  Horários mais cheios: {m.peakHours.map((h) => `${h.hour}h`).join(', ')}.
                </p>
              )}
            </section>

            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900">{orders ? 'Mais vendidos na semana' : 'Serviços que mais faturaram na semana'}</h3>
              {m.topServices.length ? (
                <ul className="space-y-1.5">
                  {m.topServices.map((s) => (
                    <li key={s.service} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-bold truncate">{s.service}</span>
                      <span className="text-slate-500 shrink-0 ml-2">
                        {s.count}× · {brl(s.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">{orders ? 'Nenhum pedido vendido nesta semana.' : 'Nenhum atendimento feito nesta semana.'}</p>
              )}
              <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-1">
                <p>
                  {m.messages.inbound} mensagens recebidas
                  {m.messages.afterHours ? `, ${m.messages.afterHours} fora do horário de atendimento` : ''}.
                </p>
                {m.lapsed.count > 0 && (
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span>{m.lapsed.count} clientes não {orders ? 'pedem' : 'voltam'} há mais de 30 dias.</span>
                    {m.lapsed.leadIds.length > 0 && (
                      <Link href={orders ? '/disparos?publico=sumidos&fonte=pedidos' : '/disparos?publico=sumidos'} className="font-bold text-domu-blue hover:underline">
                        Chamar esses clientes
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
