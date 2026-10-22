'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import type { AtRiskTenant, FunnelStage, TenantContact } from '@/lib/platformInsights';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { PAYMENT_BADGE, brl, formatPhone, fullDate, relativeTime, whatsappLink } from './contactFormat';

type Period = 30 | 90 | null;

type InsightsData = {
  funnel: FunnelStage[];
  atRisk: AtRiskTenant[];
  mrrAtRisk: number;
  payingTotal: number;
  riskInactiveDays: number;
};

/** Mensagem pronta ao abrir o WhatsApp de quem parou em cada etapa. */
const STAGE_MESSAGE: Record<string, string> = {
  connected: 'Oi! Aqui é da Domu. Vi que você criou sua conta, mas ainda não conectou o WhatsApp. Posso te ajudar nisso agora?',
  activated: 'Oi! Aqui é da Domu. Seu WhatsApp já está conectado — falta só ativar o plano para começar a disparar. Ficou alguma dúvida?',
  first_campaign: 'Oi! Aqui é da Domu. Sua conta está pronta, mas a primeira campanha ainda não saiu. Quer que eu te ajude a montar?',
  active_7d: 'Oi! Aqui é da Domu. Faz alguns dias que você não usa o painel. Está tudo certo? Posso ajudar em algo?',
};
const RISK_MESSAGE = 'Oi! Aqui é da Domu. Passando para saber como está sendo usar a plataforma e se posso te ajudar em algo.';

const segmentLabel = (s: string) => SEGMENT_LABELS[s as keyof typeof SEGMENT_LABELS] || s;

function ContactLinks({ contact, message }: { contact: TenantContact | null; message: string }) {
  if (!contact) return <span className="text-[11px] text-slate-400">Sem contato</span>;
  const wa = whatsappLink(contact.phone, message);
  return (
    <div className="text-xs space-y-0.5 min-w-0">
      <p className="font-bold text-slate-700 truncate">{contact.name || '—'}</p>
      <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-domu-blue break-all">
        <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {contact.email}
      </a>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-slate-600 hover:text-emerald-700">
          <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> {formatPhone(contact.phone)}
        </a>
      ) : null}
    </div>
  );
}

export default function InsightsMonitor() {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openStage, setOpenStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/interno/insights${period ? `?days=${period}` : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar o funil.');
        return;
      }
      setData(json);
      setError('');
    } catch {
      setError('Não foi possível carregar o funil.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useAutoRefresh(load, { intervalMs: 5 * 60_000 });

  const funnel = data?.funnel || [];
  const total = funnel[0]?.count || 0;
  // Etapa com a maior perda: onde vale agir primeiro.
  const worst = funnel.slice(1).reduce<FunnelStage | null>(
    (acc, s) => (s.stuck.length && (!acc || s.stuck.length > acc.stuck.length) ? s : acc),
    null
  );
  const highRisk = data?.atRisk.filter((r) => r.severity === 'high').length || 0;

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p> : null}

      {/* ───────── Funil ───────── */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900">Funil de cadastro</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Do cadastro ao uso de verdade. Clique numa etapa para ver quem parou nela e chamar no WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(
                [
                  [30, 'Cadastros em 30 dias'],
                  [90, '90 dias'],
                  [null, 'Todos'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${period === value ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              aria-label="Atualizar"
              className="inline-flex items-center text-slate-600 border border-slate-200 rounded-lg p-1.5 hover:border-domu-blue/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading && !data ? (
          <p className="px-4 py-6 text-sm text-slate-500">Montando o funil…</p>
        ) : total === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nenhum cadastro nesse período.</p>
        ) : (
          <>
            {worst ? (
              <p className="mx-4 mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Maior perda: <strong>{worst.stuck.length}</strong> empresa(s) pararam antes de <strong>{worst.label.toLowerCase()}</strong>.
              </p>
            ) : null}
            <ul className="p-4 space-y-2">
              {funnel.map((stage, i) => {
                const expanded = openStage === stage.id;
                const canExpand = i > 0 && stage.stuck.length > 0;
                return (
                  <li key={stage.id} className="rounded-lg border border-slate-100">
                    <button
                      type="button"
                      onClick={() => canExpand && setOpenStage(expanded ? null : stage.id)}
                      className={`w-full text-left px-3 py-2.5 ${canExpand ? 'hover:bg-slate-50' : 'cursor-default'}`}
                      aria-expanded={canExpand ? expanded : undefined}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        {canExpand ? (
                          expanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span className="font-bold text-slate-900">{stage.label}</span>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">{stage.hint}</span>
                        <span className="ml-auto font-black text-slate-900">{stage.count}</span>
                        <span className="w-12 text-right text-[11px] font-bold text-slate-500">{stage.percentOfTotal}%</span>
                      </div>
                      <div className="mt-1.5 ml-6 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-domu-blue" style={{ width: `${Math.max(stage.percentOfTotal, stage.count ? 2 : 0)}%` }} />
                      </div>
                      {i > 0 ? (
                        <p className="mt-1 ml-6 text-[11px] text-slate-500">
                          {stage.percentOfPrevious}% de quem chegou na etapa anterior
                          {stage.stuck.length ? (
                            <span className="text-amber-700 font-bold"> · {stage.stuck.length} parou(aram) aqui</span>
                          ) : null}
                        </p>
                      ) : null}
                    </button>
                    {expanded ? (
                      <ul className="border-t border-slate-100 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {stage.stuck.map((t) => (
                          <li key={t.tenantId} className="px-4 py-2.5 ml-6 grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{t.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {segmentLabel(t.segment)} · cadastro {relativeTime(t.createdAt)}
                              </p>
                            </div>
                            <ContactLinks contact={t.contact} message={STAGE_MESSAGE[stage.id] || RISK_MESSAGE} />
                            <span className={`justify-self-start sm:justify-self-end text-[11px] font-bold border rounded-full px-2 py-0.5 ${PAYMENT_BADGE[t.paymentState].className}`}>
                              {PAYMENT_BADGE[t.paymentState].text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ───────── Clientes em risco ───────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Clientes em risco</p>
          <p className={`mt-1 text-2xl font-black ${data?.atRisk.length ? 'text-amber-600' : 'text-slate-900'}`}>{data?.atRisk.length ?? '—'}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {data ? `de ${data.payingTotal} pagante(s) · ${highRisk} grave(s)` : ''}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Receita em risco</p>
          <p className={`mt-1 text-2xl font-black ${data?.mrrAtRisk ? 'text-red-600' : 'text-slate-900'}`}>{data ? brl(data.mrrAtRisk) : '—'}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">por mês, se esses clientes cancelarem</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Critério</p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Paga (ou atrasou) e: sem uso há {data?.riskInactiveDays ?? 14}+ dias, nunca disparou, parou de disparar ou está sem WhatsApp conectado.
          </p>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Clientes em risco de cancelar
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Mais graves e que pagam mais primeiro. “Uso” = alguém da empresa entrou, disparou ou teve agendamento.
          </p>
        </div>
        {!data ? null : data.atRisk.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum pagante em risco agora. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[920px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-bold">Empresa</th>
                  <th className="px-4 py-2 font-bold">Por que está em risco</th>
                  <th className="px-4 py-2 font-bold">Último uso</th>
                  <th className="px-4 py-2 font-bold">Contato</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.map((r) => (
                  <tr key={r.tenantId} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${r.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'}`}
                          title={r.severity === 'high' ? 'Grave' : 'Atenção'}
                        />
                        <p className="font-bold text-slate-900">{r.name}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {segmentLabel(r.segment)} · {r.planTier || '—'} · {brl(r.monthlyPrice)}/mês
                      </p>
                      <span className={`inline-flex mt-1 text-[10px] font-bold border rounded-full px-2 py-0.5 ${PAYMENT_BADGE[r.paymentState].className}`}>
                        {PAYMENT_BADGE[r.paymentState].text}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.reasons.map((reason) => (
                          <span
                            key={reason.code}
                            className={`text-[11px] font-bold rounded-full px-2 py-0.5 border ${
                              reason.code === 'past_due' || reason.code === 'never_used'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {reason.text}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      <p className="font-bold" title={fullDate(r.lastActivityAt)}>
                        {relativeTime(r.lastActivityAt, 'Nunca usou')}
                      </p>
                      <p className="text-[11px] text-slate-400">Login: {relativeTime(r.lastLoginAt)}</p>
                      <p className="text-[11px] text-slate-400">Campanha: {relativeTime(r.lastCampaignAt)}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <ContactLinks contact={r.contact} message={RISK_MESSAGE} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
