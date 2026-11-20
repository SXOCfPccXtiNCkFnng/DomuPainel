'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { formatBRL, type ImprovementTip, type OrderMetrics } from '@/lib/pizzeria';
import type { SalesIntelligence } from '@/lib/salesIntelligence';
import SalesIntelligencePanel, { ProLockedCard } from '@/components/shared/SalesIntelligencePanel';
import AskAiBox from '@/components/shared/AskAiBox';

type Usage = {
  planName: string;
  dispatches: { used: number; limit: number };
  conversations: { used: number; limit: number } | null;
  users: { used: number; limit: number };
  menuItems: number;
};
type Data = {
  days: number;
  metrics: OrderMetrics;
  tips: ImprovementTip[];
  intelligenceAllowed: boolean;
  intelligence: SalesIntelligence | null;
  assistant: { enabled: boolean; conversations: number; orders: number; conversionRate: number | null };
  usage: Usage;
};

const dayLabel = (key: string) => key.split('-').reverse().slice(0, 2).join('/');

function change(current: number, previous: number): { hint: string; tone?: 'good' | 'bad' } {
  if (!previous) return { hint: 'sem período anterior para comparar' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { hint: 'igual ao período anterior' };
  return { hint: `${pct > 0 ? '+' : ''}${pct}% que o período anterior`, tone: pct > 0 ? 'good' : 'bad' };
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-1">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="text-xl font-black tracking-tight text-slate-900">{value}</p>
      {hint && <p className={`text-[10.5px] ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );
}

function Meter({ label, used, limit, hint }: { label: string; used: number; limit: number; hint?: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="text-slate-600">
          {used.toLocaleString('pt-BR')} de {limit.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={label}>
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="text-[10.5px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Barras verticais de uma série (faturamento por dia). Tooltip no hover. */
function DailyBars({ daily }: { daily: OrderMetrics['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.revenue));
  const step = Math.ceil(daily.length / 8);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-36" role="img" aria-label="Faturamento por dia">
        {daily.map((d) => (
          <div key={d.date} className="flex-1 h-full flex items-end group relative" title={`${dayLabel(d.date)}: ${formatBRL(d.revenue)} · ${d.orders} pedidos`}>
            <div className="w-full bg-domu-blue rounded-t group-hover:opacity-80" style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1 border-t border-slate-200 pt-1">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 text-[9.5px] text-slate-400 text-center truncate">
            {i % step === 0 ? dayLabel(d.date) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function HBars({ rows, unit }: { rows: { label: string; value: number; hint: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]" title={r.hint}>
          <span className="w-24 text-slate-600 font-bold truncate">{r.label}</span>
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-domu-blue rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-20 text-right text-slate-600">
            {r.value.toLocaleString('pt-BR')} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function VendasPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/pizzeria/metrics?days=${d}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar as métricas.');
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError('Não foi possível carregar as métricas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const m = data?.metrics;

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex items-center gap-1.5">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${days === d ? 'bg-domu-blue text-white border-domu-blue' : 'border-slate-200 text-slate-600 bg-white'}`}
          >
            {d} dias
          </button>
        ))}
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-2" />}
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {m && data && (
        <>
          {!data.intelligenceAllowed && (
            <ProLockedCard
              title="Inteligência de vendas é do plano Pro"
              text="No Pro a Domu mostra o que mais vende em cada dia da semana, o que sai junto (para montar combos), o que subiu ou caiu, onde melhorar e manda dicas da semana escritas pela IA para você vender mais."
            />
          )}

          {data.intelligenceAllowed && (
          <section className="space-y-2">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-domu-blue" /> Onde dá para melhorar
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {data.tips.map((t) => (
                <div key={t.title} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-black text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed flex-1">{t.text}</p>
                  {t.href && t.action && (
                    <Link href={t.href} className="text-xs font-bold text-domu-blue flex items-center gap-1 hover:underline">
                      {t.action} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10.5px] text-slate-400">
              Toda semana a IA analisa esses números e as conversas e manda dicas mais detalhadas.{' '}
              <Link href="/dicas" className="font-bold text-domu-blue hover:underline">
                Ver dicas da semana
              </Link>
            </p>
          </section>
          )}

          {data.intelligenceAllowed && <AskAiBox />}

          {data.intelligence && <SalesIntelligencePanel data={data.intelligence} period={`últimos ${data.days} dias`} />}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Faturamento" value={formatBRL(m.revenue)} {...change(m.revenue, m.prevRevenue)} />
            <Stat label="Pedidos" value={String(m.orders)} {...change(m.orders, m.prevOrders)} />
            <Stat label="Ticket médio" value={formatBRL(m.averageTicket)} {...change(m.averageTicket, m.prevAverageTicket)} />
            <Stat
              label="Cancelados"
              value={`${m.cancelled} (${m.cancelRate}%)`}
              hint={m.lostRevenue ? `${formatBRL(m.lostRevenue)} perdidos` : undefined}
              tone={m.cancelRate >= 8 ? 'bad' : undefined}
            />
            <Stat
              label="Pedidos pela atendente IA"
              value={String(m.byWhatsApp)}
              hint={
                data.assistant.enabled
                  ? `${formatBRL(m.byWhatsAppRevenue)}${data.assistant.conversionRate != null ? ` · ${data.assistant.conversionRate}% das conversas viraram pedido` : ''}`
                  : 'Atendente desligada'
              }
            />
            <Stat label="Entrega x retirada" value={`${m.delivery} / ${m.pickup}`} hint={m.deliveryFees ? `${formatBRL(m.deliveryFees)} em taxas de entrega` : undefined} />
            <Stat
              label="Tempo médio de entrega"
              value={m.avgDeliveryMinutes != null ? `${m.avgDeliveryMinutes} min` : '—'}
              hint={m.avgPrepMinutes != null ? `Preparo: ${m.avgPrepMinutes} min` : 'Avance os pedidos no quadro para medir'}
              tone={m.avgDeliveryMinutes != null && m.avgDeliveryMinutes > 60 ? 'bad' : undefined}
            />
            <Stat
              label="Clientes"
              value={String(m.customers.unique)}
              hint={`${m.customers.new} novos · ${m.customers.repeatRate}% pediram mais de uma vez`}
            />
          </div>

          <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-900">Faturamento por dia</h3>
            {m.orders ? <DailyBars daily={m.daily} /> : <p className="text-xs text-slate-400">Nenhum pedido no período.</p>}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900">Pedidos por dia da semana</h3>
              <HBars
                rows={[1, 2, 3, 4, 5, 6, 0].map((i) => {
                  const d = m.weekdays[i];
                  return { label: d.label, value: d.orders, hint: `${d.label}: ${d.orders} pedidos · ${formatBRL(d.revenue)}` };
                })}
                unit="ped."
              />
              {m.peakHour != null && <p className="text-[11px] text-slate-500">Horário com mais pedidos: {m.peakHour}h às {m.peakHour + 1}h.</p>}
            </section>

            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900">Pedidos por horário</h3>
              {m.hours.length ? (
                <HBars rows={m.hours.map((h) => ({ label: `${h.hour}h`, value: h.orders, hint: `${h.hour}h: ${h.orders} pedidos` }))} unit="ped." />
              ) : (
                <p className="text-xs text-slate-400">Sem pedidos no período.</p>
              )}
            </section>

            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900">Mais vendidos</h3>
              {m.topItems.length ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10.5px] text-slate-400 text-left">
                      <th className="font-bold pb-1">Item</th>
                      <th className="font-bold pb-1 text-right">Qtd.</th>
                      <th className="font-bold pb-1 text-right">Faturou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.topItems.map((i) => (
                      <tr key={i.name} className="border-t border-slate-100">
                        <td className="py-1 font-bold text-slate-700 truncate max-w-[180px]">{i.name}</td>
                        <td className="py-1 text-right text-slate-600">{i.quantity.toLocaleString('pt-BR')}</td>
                        <td className="py-1 text-right text-slate-600">{formatBRL(i.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-400">Sem vendas no período.</p>
              )}
              <p className="text-[10.5px] text-slate-400">Pizza meio a meio conta meia para cada sabor.</p>
            </section>

            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900">Clientes</h3>
              {m.topCustomers.length > 0 && (
                <ul className="space-y-1">
                  {m.topCustomers.map((c) => (
                    <li key={c.phone} className="flex justify-between text-xs">
                      <span className="font-bold text-slate-700 truncate">{c.name}</span>
                      <span className="text-slate-500 shrink-0 ml-2">
                        {c.orders} pedidos · {formatBRL(c.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2">
                <span>
                  {m.lapsed.count} clientes não pedem há mais de 3 semanas
                  {m.lapsed.sample.length ? ` (ex.: ${m.lapsed.sample.join(', ')})` : ''}.
                </span>
                {m.lapsed.leadIds.length > 0 && (
                  <Link href="/disparos?publico=sumidos&fonte=pedidos" className="font-bold text-domu-blue hover:underline">
                    Mandar campanha de retorno
                  </Link>
                )}
              </div>
            </section>
          </div>

          <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-black text-slate-900">Consumo do plano {data.usage.planName} neste mês</h3>
              <Link href="/assinatura" className="text-[11px] font-bold text-domu-blue hover:underline">
                Ver planos
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.usage.conversations && (
                <Meter
                  label="Conversas da atendente"
                  used={data.usage.conversations.used}
                  limit={data.usage.conversations.limit}
                  hint="Cada cliente atendido num dia conta uma conversa."
                />
              )}
              <Meter label="Disparos de campanha" used={data.usage.dispatches.used} limit={data.usage.dispatches.limit} hint="Avisos de pedido não contam aqui." />
              <Meter label="Usuários" used={data.usage.users.used} limit={data.usage.users.limit} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
