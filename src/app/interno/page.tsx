'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import type { PlatformOverview, SubscriptionStatus } from '@/lib/platformOverview';

type CouponRow = {
  code: string;
  percent_off: number | null;
  active: boolean;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  description: string | null;
};

function statusLabel(status: SubscriptionStatus) {
  switch (status) {
    case 'ACTIVE':
      return { text: 'Pagando', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'TRIAL':
      return { text: 'Trial', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'PENDING_PAYMENT':
      return { text: 'Aguardando pagamento', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'PAST_DUE':
      return { text: 'Em atraso', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'CANCELED':
      return { text: 'Cancelada', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return { text: 'Sem assinatura', className: 'bg-slate-50 text-slate-500 border-slate-200' };
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({
  label,
  value,
  hint,
  tone = 'navy',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'navy' | 'green' | 'amber' | 'red' | 'slate';
}) {
  const tones = {
    navy: 'bg-[#0B132B] text-white border-[#1E293B]',
    green: 'bg-white text-slate-900 border-slate-200',
    amber: 'bg-white text-slate-900 border-slate-200',
    red: 'bg-white text-slate-900 border-slate-200',
    slate: 'bg-white text-slate-900 border-slate-200',
  };
  const valueColor =
    tone === 'green'
      ? 'text-emerald-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'red'
          ? 'text-red-600'
          : tone === 'navy'
            ? 'text-white'
            : 'text-slate-900';

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${tone === 'navy' ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`mt-1 text-3xl font-black ${valueColor}`}>{value}</p>
      {hint ? (
        <p className={`mt-1 text-[11px] ${tone === 'navy' ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>
      ) : null}
    </div>
  );
}

export default function InternoPage() {
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponPercent, setCouponPercent] = useState('100');
  const [couponMax, setCouponMax] = useState('5');
  const [couponMsg, setCouponMsg] = useState('');
  const [grantBusy, setGrantBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interno/overview', { cache: 'no-store' });
      if (res.status === 404 || res.status === 401) {
        setBlocked(true);
        setOverview(null);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.overview) {
        setBlocked(true);
        return;
      }
      setOverview(json.overview);
      const couponsRes = await fetch('/api/interno/coupons', { cache: 'no-store' });
      if (couponsRes.ok) {
        const cjson = await couponsRes.json();
        if (cjson.success) setCoupons(cjson.coupons || []);
      }
    } catch {
      setError('Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponMsg('');
    const res = await fetch('/api/interno/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: couponCode,
        percentOff: Number(couponPercent),
        maxRedemptions: couponMax === '' ? null : Number(couponMax),
        description: Number(couponPercent) >= 100 ? 'Cortesia / teste' : undefined,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setCouponMsg(json.error || 'Não foi possível criar.');
      return;
    }
    setCouponMsg(`Cupom ${json.coupon.code} criado. A pessoa digita isso no checkout.`);
    setCouponCode('');
    load();
  }

  async function toggleCoupon(code: string, active: boolean) {
    await fetch('/api/interno/coupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, active }),
    });
    load();
  }

  async function grantAccess(tenantId: string) {
    setGrantBusy(tenantId);
    try {
      const res = await fetch('/api/interno/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planTier: 'STARTER' }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error || 'Falha ao liberar.');
      else await load();
    } finally {
      setGrantBusy(null);
    }
  }

  if (blocked) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-md max-w-md w-full space-y-4">
          <span className="text-4xl font-black text-domu-blue">404</span>
          <h2 className="text-lg font-black text-slate-900">Página Não Encontrada</h2>
          <p className="text-xs text-slate-500">
            A página que você está procurando não existe ou foi movida.
          </p>
          <Link href="/" className="inline-block btn-domu-primary text-xs py-2 px-4 shadow-sm">
            Voltar ao Inicio
          </Link>
        </div>
      </div>
    );
  }

  const t = overview?.totals;
  const c = overview?.campaigns7d;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue">Operação Domu</p>
          <h1 className="text-2xl font-black text-slate-900">Visão da plataforma</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastros, assinaturas e saúde recente das campanhas. Só quem está na lista interna vê isto.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-domu-blue/40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      {loading && !overview ? (
        <p className="text-sm text-slate-500">Carregando números…</p>
      ) : null}

      {t ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Empresas" value={t.tenants} hint={`${t.users} usuários`} tone="navy" />
            <StatCard label="Pagando" value={t.paying} hint="Assinatura ACTIVE" tone="green" />
            <StatCard label="Em atraso" value={t.pastDue} hint="PAST_DUE" tone="red" />
            <StatCard label="Aguardando PIX/cartão" value={t.pendingPayment} hint="PENDING_PAYMENT" tone="amber" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Trial" value={t.trial} tone="slate" />
            <StatCard label="Canceladas" value={t.canceled} tone="slate" />
            <StatCard label="Sem assinatura" value={t.noSubscription} tone="slate" />
            <StatCard
              label="Campanhas (7 dias)"
              value={c?.total || 0}
              hint={`${c?.failed || 0} falhas · ${c?.scheduled || 0} agendadas`}
              tone="slate"
            />
          </div>
        </>
      ) : null}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-900">Erros e falhas recentes</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Campanhas, envios, checkout e cron. Sem Sentry ainda — isto vem do próprio banco.
          </p>
        </div>
        {(overview?.alerts || []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nenhum erro recente. Quando algo falhar, aparece aqui.</p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {(overview?.alerts || []).map((alert) => (
              <li key={alert.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 border border-red-100 rounded-full px-2 py-0.5">
                    {alert.source}
                  </span>
                  {alert.tenantName ? (
                    <span className="text-[11px] text-slate-500">{alert.tenantName}</span>
                  ) : null}
                  <span className="text-[11px] text-slate-400 ml-auto">{formatDate(alert.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-800 mt-1">{alert.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-900">Cupons (entrar sem pagar ou com desconto)</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            100% libera o plano na hora, sem PIX. A pessoa cola o código no onboarding/assinatura.
          </p>
        </div>
        <form onSubmit={createCoupon} className="flex flex-wrap gap-2 items-end">
          <label className="text-xs font-bold text-slate-600">
            Código
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="EX: DOMUTESTE"
              className="mt-1 block w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            % desconto
            <select
              value={couponPercent}
              onChange={(e) => setCouponPercent(e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="100">100% (grátis)</option>
              <option value="50">50%</option>
              <option value="20">20%</option>
              <option value="10">10%</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Usos máx.
            <input
              value={couponMax}
              onChange={(e) => setCouponMax(e.target.value)}
              placeholder="ilimitado"
              className="mt-1 block w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button type="submit" className="btn-domu-primary text-xs py-2 px-4">
            Criar cupom
          </button>
        </form>
        {couponMsg ? <p className="text-xs text-slate-600">{couponMsg}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-slate-500">
              <tr>
                <th className="py-1">Código</th>
                <th className="py-1">Desconto</th>
                <th className="py-1">Usos</th>
                <th className="py-1">Status</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.code} className="border-t border-slate-100">
                  <td className="py-2 font-mono font-bold">{c.code}</td>
                  <td className="py-2">{c.percent_off != null ? `${c.percent_off}%` : '—'}</td>
                  <td className="py-2 text-slate-600">
                    {c.redemption_count}
                    {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ''}
                  </td>
                  <td className="py-2">{c.active ? 'Ativo' : 'Inativo'}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => toggleCoupon(c.code, !c.active)}
                      className="text-[11px] font-bold text-domu-blue"
                    >
                      {c.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500 text-sm">
                    Nenhum cupom ainda. Crie um de 100% para testes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Empresas</h2>
          {overview?.generatedAt ? (
            <span className="text-[11px] text-slate-400">Atualizado {formatDate(overview.generatedAt)}</span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-bold">Empresa</th>
                <th className="px-4 py-2 font-bold">Segmento</th>
                <th className="px-4 py-2 font-bold">Plano</th>
                <th className="px-4 py-2 font-bold">Assinatura</th>
                <th className="px-4 py-2 font-bold">Valor</th>
                <th className="px-4 py-2 font-bold">Cadastro</th>
                <th className="px-4 py-2 font-bold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.tenants || []).map((row) => {
                const badge = statusLabel(row.subscriptionStatus);
                return (
                  <tr key={row.tenantId} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-900">{row.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{row.tenantId.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{row.segment}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.planTier || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex text-[11px] font-bold border rounded-full px-2 py-0.5 ${badge.className}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {row.monthlyPrice != null
                        ? row.monthlyPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {row.subscriptionStatus !== 'ACTIVE' && row.subscriptionStatus !== 'TRIAL' ? (
                        <button
                          type="button"
                          disabled={grantBusy === row.tenantId}
                          onClick={() => grantAccess(row.tenantId)}
                          className="text-[11px] font-bold text-domu-blue disabled:opacity-50"
                        >
                          {grantBusy === row.tenantId ? 'Liberando…' : 'Liberar 30 dias'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && overview && overview.tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                    Nenhuma empresa cadastrada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
