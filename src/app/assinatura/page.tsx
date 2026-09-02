'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Zap,
  Users,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { getAuthItem } from '@/lib/authStorage';
import { PLAN_DISPATCH_LIMITS, PLAN_PRICES_BRL, PlanTier } from '@/lib/planLimits';

const PLANS: {
  tier: PlanTier;
  name: string;
  eyebrow: string;
  blurb: string;
  features: string[];
  popular?: boolean;
}[] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    eyebrow: 'Começar',
    blurb: 'Disparos oficiais via Meta Cloud API, com trava diária de segurança.',
    features: [
      PLAN_DISPATCH_LIMITS.STARTER.labelMonthly,
      PLAN_DISPATCH_LIMITS.STARTER.labelDaily!,
      'Meta Cloud API Oficial',
      'Coexistência Celular + Web',
    ],
  },
  {
    tier: 'PRO',
    name: 'Pro',
    eyebrow: 'Mais popular',
    blurb: 'Mais volume, equipe e suporte prioritário para operações em crescimento.',
    popular: true,
    features: [
      PLAN_DISPATCH_LIMITS.PRO.labelMonthly,
      'Sem teto diário no portal',
      'Até 10 usuários na conta',
      'Coexistência Celular + Web',
      'Suporte prioritário DOMU',
    ],
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    eyebrow: 'Escala',
    blurb: 'Volume alto, API dedicada e acompanhamento próximo da operação.',
    features: [
      PLAN_DISPATCH_LIMITS.ENTERPRISE.labelMonthly,
      'API direta / número dedicado',
      'Multi-operadores no mesmo canal',
      'Gerente de conta dedicado',
    ],
  },
];

export default function AssinaturaPage() {
  const [loading, setLoading] = useState(true);
  const [updatingTier, setUpdatingTier] = useState<string | null>(null);
  const [subData, setSubData] = useState({
    planTier: 'STARTER' as PlanTier,
    planName: 'Plano Starter',
    priceBrl: 197,
    dispatchesUsed: 0,
    messageLimit: 1500,
    agentsUsed: 0,
    agentsLimit: 0,
    status: 'ACTIVE',
    paymentMethod: 'PIX',
    renewalDate: '01/10',
  });

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(`/api/subscription?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success && json.subscription) {
        setSubData({
          planTier: (json.subscription.planTier || 'STARTER') as PlanTier,
          planName: json.subscription.planName || 'Plano Starter',
          priceBrl: json.subscription.priceBrl || 197,
          dispatchesUsed: json.subscription.dispatchesUsed || 0,
          messageLimit: json.subscription.messageLimit || 1500,
          agentsUsed: json.subscription.agentsUsed || 0,
          agentsLimit: json.subscription.agentsLimit ?? 0,
          status: json.subscription.status || 'ACTIVE',
          paymentMethod: json.subscription.paymentMethod || 'PIX',
          renewalDate: json.subscription.renewalDate || '01/10',
        });
      }
    } catch (err) {
      console.error('Erro ao buscar assinatura:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (newPlanTier: PlanTier) => {
    if (newPlanTier === subData.planTier) return;
    setUpdatingTier(newPlanTier);
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: storedTenantId, planTier: newPlanTier }),
      });
      const json = await res.json();
      if (json.success) await fetchSubscription();
      else alert(json.error || 'Falha ao alterar plano.');
    } catch (err) {
      console.error('Erro ao atualizar plano:', err);
    } finally {
      setUpdatingTier(null);
    }
  };

  const limitLabel =
    subData.messageLimit >= 100000
      ? 'Ilimitados'
      : subData.messageLimit.toLocaleString('pt-BR');
  const usagePercentage = Math.min(
    100,
    Math.round((subData.dispatchesUsed / Math.max(subData.messageLimit, 1)) * 100)
  );

  return (
    <div className="space-y-8 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-1">
            Conta e faturamento
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Assinatura e Planos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o uso e escolha o plano certo para o volume da sua operação.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ativa · renovação {subData.renewalDate}
        </span>
      </div>

      {/* Current plan — light card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100">
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-domu-blue bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
              Plano atual
            </span>
            <h2 className="text-xl font-black text-slate-900">
              {loading ? '…' : subData.planName}
            </h2>
            <p className="text-sm text-slate-500 max-w-md">
              {subData.planTier === 'STARTER'
                ? 'Disparos via Meta Cloud API Oficial, com limites pensados para começar com segurança.'
                : 'Coexistência, atendimento e volume maior para escalar campanhas.'}
            </p>
          </div>
          <div className="text-left lg:text-right shrink-0">
            <p className="text-3xl font-black text-slate-900 tracking-tight">
              R$ {subData.priceBrl}
              <span className="text-sm font-semibold text-slate-400">/mês</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {subData.paymentMethod === 'CREDIT_CARD' ? 'Cartão mensal' : 'PIX recorrente mensal'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Zap className="w-4 h-4 text-domu-blue" />
              <span className="text-xs font-bold">Disparos no mês</span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {subData.dispatchesUsed.toLocaleString('pt-BR')}
              <span className="text-sm font-semibold text-slate-400"> / {limitLabel}</span>
            </p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-domu-blue rounded-full transition-all"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="w-4 h-4 text-domu-blue" />
              <span className="text-xs font-bold">Equipe / atendimento</span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {subData.agentsUsed}
              <span className="text-sm font-semibold text-slate-400">
                {' '}
                / {subData.agentsLimit > 100 ? '∞' : subData.agentsLimit} usuários
              </span>
            </p>
            <p className="text-[11px] text-slate-400">Membros ativos na conta</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold">Coexistência Meta</span>
            </div>
            <p className="text-lg font-black text-emerald-600">Ativa</p>
            <p className="text-[11px] text-slate-400">Celular + API no mesmo número</p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900">Comparar planos</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Troca de plano é registrada na sua conta. Cobrança conforme o ciclo vigente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = subData.planTier === plan.tier;
            const price = PLAN_PRICES_BRL[plan.tier];
            return (
              <div
                key={plan.tier}
                className={`relative bg-white rounded-2xl border p-6 flex flex-col ${
                  isCurrent
                    ? 'border-domu-blue shadow-md shadow-blue-500/10'
                    : plan.popular
                      ? 'border-slate-200 shadow-sm'
                      : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-extrabold uppercase bg-domu-blue text-white px-2.5 py-0.5 rounded-full">
                    Mais popular
                  </span>
                )}
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {plan.eyebrow}
                </p>
                <h4 className="text-lg font-black text-slate-900 mt-1">{plan.name}</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[40px]">
                  {plan.blurb}
                </p>
                <p className="mt-4 mb-5">
                  <span className="text-3xl font-black text-slate-900">R$ {price}</span>
                  <span className="text-xs text-slate-400 font-semibold">/mês</span>
                </p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-domu-blue shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 rounded-xl bg-blue-50 text-domu-blue text-xs font-bold border border-blue-100"
                  >
                    Plano atual
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan.tier)}
                    disabled={Boolean(updatingTier)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      plan.popular
                        ? 'bg-domu-blue text-white hover:bg-blue-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {updatingTier === plan.tier ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    {plan.tier === 'STARTER' ? 'Mudar para Starter' : `Ir para ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
