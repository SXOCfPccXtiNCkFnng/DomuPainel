'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Brain, Lock } from 'lucide-react';
import type { SalesIntelligence } from '@/lib/salesIntelligence';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Card mostrado no Starter no lugar da inteligência de vendas. */
export function ProLockedCard({ title, text }: { title: string; text: string }) {
  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
      <div className="w-11 h-11 rounded-full bg-blue-50 text-domu-blue flex items-center justify-center shrink-0">
        <Lock className="w-5 h-5" />
      </div>
      <div className="flex-1 space-y-1">
        <h2 className="text-sm font-black text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
      </div>
      <Link href="/assinatura" className="btn-domu-primary text-xs py-2 px-4 shrink-0 w-fit">
        Ver plano Pro
      </Link>
    </section>
  );
}

/**
 * Inteligência de vendas: o que vende mais em cada dia da semana (tabela com
 * tom de azul pela quantidade, números sempre visíveis), o que sai junto e as
 * frases com o que fazer.
 */
export default function SalesIntelligencePanel({ data, period }: { data: SalesIntelligence; period: string }) {
  const max = Math.max(1, ...data.weekdayMatrix.flatMap((r) => r.byWeekday));
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-domu-blue" /> Inteligência de vendas
        </h2>
        <p className="text-[11px] text-slate-500">
          O que mais vende, em que dia e o que sai junto ({period}, {data.sales} {data.unit}).
        </p>
      </div>

      {data.sales < 5 ? (
        <p className="text-xs text-slate-500 bg-white border border-slate-200/80 rounded-2xl p-4">
          Ainda há poucos {data.unit} para encontrar padrões. Conforme o movimento for registrado, aparecem aqui o campeão de cada dia, os combos e o que está subindo ou caindo.
        </p>
      ) : (
        <>
          {data.insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.insights.map((i) => (
                <div key={i.title} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-black text-slate-900">{i.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed flex-1">{i.text}</p>
                  {i.href && i.action && (
                    <Link href={i.href} className="text-xs font-bold text-domu-blue flex items-center gap-1 hover:underline">
                      {i.action} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2 overflow-x-auto">
              <h3 className="text-xs font-black text-slate-900">Mais vendidos por dia da semana</h3>
              <table className="w-full text-[11px] min-w-[420px]">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left font-bold pb-1">Item</th>
                    {DAYS.map((d) => (
                      <th key={d} className="font-bold pb-1 text-center w-11">
                        {SHORT[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.weekdayMatrix.map((row) => (
                    <tr key={row.item}>
                      <td className="py-0.5 pr-2 font-bold text-slate-700 truncate max-w-[160px]">{row.item}</td>
                      {DAYS.map((d) => {
                        const v = row.byWeekday[d];
                        const strength = v / max;
                        return (
                          <td key={d} className="p-[2px]">
                            <div
                              title={`${row.item} · ${SHORT[d]}: ${v.toLocaleString('pt-BR')}`}
                              className="h-7 rounded flex items-center justify-center font-bold"
                              style={{
                                backgroundColor: v ? `rgba(30, 90, 246, ${0.1 + strength * 0.75})` : 'transparent',
                                color: strength > 0.55 ? '#fff' : undefined,
                              }}
                            >
                              <span className={strength > 0.55 ? '' : 'text-slate-600'}>{v ? v.toLocaleString('pt-BR') : '·'}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10.5px] text-slate-400">Quanto mais escuro, mais vendeu naquele dia.</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="space-y-1.5">
                <h3 className="text-xs font-black text-slate-900">Campeão de cada dia</h3>
                {DAYS.map((d) => {
                  const t = data.topByWeekday[d];
                  return (
                    <p key={d} className="flex justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 font-bold w-10">{SHORT[d]}</span>
                      <span className="text-slate-700 truncate flex-1">{t.item || '—'}</span>
                      {t.item && <span className="text-slate-400 shrink-0">{t.quantity.toLocaleString('pt-BR')}</span>}
                    </p>
                  );
                })}
              </div>
              {data.pairs.length > 0 && (
                <div className="space-y-1 border-t border-slate-100 pt-2">
                  <h3 className="text-xs font-black text-slate-900">Saem juntos</h3>
                  {data.pairs.map((p) => (
                    <p key={`${p.a}-${p.b}`} className="text-[11px] text-slate-600">
                      {p.a} + {p.b} <span className="text-slate-400">· {Math.round(p.rate * 100)}%</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
