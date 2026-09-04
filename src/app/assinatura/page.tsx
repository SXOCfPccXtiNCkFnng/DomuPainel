'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Zap,
  Users,
  Shield,
  ArrowRight,
  X,
  QrCode,
  CreditCard,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { getAuthItem, setAuthItem } from '@/lib/authStorage';
import { PLAN_DISPATCH_LIMITS, PLAN_PRICES_BRL, PlanTier } from '@/lib/planLimits';
import { LegalDocumentModal, LegalDoc } from '@/components/shared/LegalDocumentModal';

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
    blurb: 'Disparos oficiais via WhatsApp da Meta, com trava diária de segurança.',
    features: [
      PLAN_DISPATCH_LIMITS.STARTER.labelMonthly,
      PLAN_DISPATCH_LIMITS.STARTER.labelDaily!,
      'WhatsApp oficial da Meta',
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

const PIX_DISCOUNT = 0.05;

function statusLabel(status: string, renewalDate: string): string {
  switch (status) {
    case 'ACTIVE': return `Ativa · renovação ${renewalDate}`;
    case 'TRIAL': return `Período de teste · renovação ${renewalDate}`;
    case 'PENDING_PAYMENT': return 'Aguardando pagamento';
    case 'PAST_DUE': return `Pagamento atrasado · renovação ${renewalDate}`;
    case 'CANCELED': return 'Cancelada';
    default: return status;
  }
}

function statusStyle(status: string): string {
  if (status === 'ACTIVE' || status === 'TRIAL') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'PENDING_PAYMENT') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export default function AssinaturaPage() {
  const [needsPayment, setNeedsPayment] = useState(false);
  const [loading, setLoading] = useState(true);
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

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<PlanTier>('STARTER');
  const [modalPaymentMethod, setModalPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [modalCpfCnpj, setModalCpfCnpj] = useState(getAuthItem('domu_billing_cpf_cnpj') || '');
  const [modalCoupon, setModalCoupon] = useState('');
  const [modalCouponMsg, setModalCouponMsg] = useState('');
  const [modalCouponDiscount, setModalCouponDiscount] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalProcessing, setModalProcessing] = useState(false);
  const [modalAcceptedTerms, setModalAcceptedTerms] = useState(false);
  const [legalModalDoc, setLegalModalDoc] = useState<LegalDoc | null>(null);

  // Payment result inside modal
  const [modalAwaitingPayment, setModalAwaitingPayment] = useState(false);
  const [modalPixPayload, setModalPixPayload] = useState<string | null>(null);
  const [modalPixImage, setModalPixImage] = useState<string | null>(null);
  const [modalInvoiceUrl, setModalInvoiceUrl] = useState<string | null>(null);
  const [modalPaymentId, setModalPaymentId] = useState<string | null>(null);
  const [modalPriceLabel, setModalPriceLabel] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNeedsPayment(new URLSearchParams(window.location.search).get('pay') === '1');
    }
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

  const planNeedsPayment = subData.status !== 'ACTIVE' && subData.status !== 'TRIAL';

  const openCheckoutModal = (tier: PlanTier) => {
    setModalPlan(tier);
    setModalPaymentMethod('PIX');
    setModalCpfCnpj(getAuthItem('domu_billing_cpf_cnpj') || '');
    setModalCoupon('');
    setModalCouponMsg('');
    setModalCouponDiscount('');
    setModalError('');
    setModalProcessing(false);
    setModalAcceptedTerms(false);
    setModalAwaitingPayment(false);
    setModalPixPayload(null);
    setModalPixImage(null);
    setModalInvoiceUrl(null);
    setModalPaymentId(null);
    setModalPriceLabel(null);
    setPixCopied(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAwaitingPayment(false);
    fetchSubscription();
  };

  const modalPlanData = PLANS.find((p) => p.tier === modalPlan) || PLANS[0];
  const modalBasePrice = PLAN_PRICES_BRL[modalPlan];
  const modalPixPrice = (modalBasePrice * (1 - PIX_DISCOUNT)).toFixed(2);
  const modalDisplayPrice = modalPaymentMethod === 'PIX' ? modalPixPrice : String(modalBasePrice);

  const handleApplyCoupon = async () => {
    setModalCouponMsg('');
    setModalCouponDiscount('');
    if (!modalCoupon.trim()) {
      setModalCouponMsg('Digite um cupom.');
      return;
    }
    try {
      const res = await fetch('/api/billing/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: modalCoupon,
          planTier: modalPlan,
          paymentMethod: modalPaymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalCouponMsg(data.error || 'Cupom inválido.');
        return;
      }
      setModalCouponDiscount(
        data.coupon.percentOff
          ? `${data.coupon.percentOff}% off`
          : `R$ ${data.coupon.amountOffBrl} off`
      );
      setModalCouponMsg(`Cupom ${data.coupon.code} aplicado · R$ ${data.price.finalPrice}/mês`);
      setModalPriceLabel(`R$ ${data.price.finalPrice}`);
    } catch {
      setModalCouponMsg('Não foi possível validar o cupom.');
    }
  };

  const handleCheckout = async () => {
    setModalError('');

    const digits = modalCpfCnpj.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) {
      setModalError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    if (!modalAcceptedTerms) {
      setModalError('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }

    setModalProcessing(true);
    setAuthItem('domu_billing_cpf_cnpj', modalCpfCnpj.trim());

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: modalPlan,
          paymentMethod: modalPaymentMethod,
          acceptedTerms: modalAcceptedTerms,
          cpfCnpj: modalCpfCnpj.trim(),
          couponCode: modalCoupon.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setModalError(json.error || 'Falha ao iniciar cobrança.');
        setModalProcessing(false);
        return;
      }

      if (json.mock || json.status === 'ACTIVE') {
        closeModal();
        return;
      }

      setModalPriceLabel(
        json.price?.finalPrice != null ? `R$ ${json.price.finalPrice}` : null
      );
      setModalPaymentId(json.asaas?.paymentId || null);
      setModalInvoiceUrl(json.asaas?.invoiceUrl || null);
      setModalPixPayload(json.asaas?.pix?.payload || null);
      setModalPixImage(json.asaas?.pix?.encodedImage || null);
      setModalAwaitingPayment(true);
    } catch {
      setModalError('Erro de conexão. Tente novamente.');
    } finally {
      setModalProcessing(false);
    }
  };

  const copyPix = async () => {
    if (!modalPixPayload) return;
    try {
      await navigator.clipboard.writeText(modalPixPayload);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    } catch { /* ignore */ }
  };

  const handleManualSync = async () => {
    setManualSyncing(true);
    try {
      const qs = modalPaymentId ? `?paymentId=${encodeURIComponent(modalPaymentId)}` : '';
      const res = await fetch(`/api/billing/status${qs}`);
      const data = await res.json();
      if (data.success && data.status === 'ACTIVE' && data.planTier === modalPlan) {
        closeModal();
      } else {
        await fetchSubscription();
      }
    } catch {
      /* ignore */
    } finally {
      setManualSyncing(false);
    }
  };

  // Poll payment status while awaiting
  const pollPayment = useCallback(async () => {
    if (!modalAwaitingPayment) return;
    try {
      const qs = modalPaymentId ? `?paymentId=${encodeURIComponent(modalPaymentId)}` : '';
      const res = await fetch(`/api/billing/status${qs}`);
      const data = await res.json();
      if (
        data.success &&
        data.status === 'ACTIVE' &&
        data.planTier === modalPlan
      ) {
        closeModal();
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAwaitingPayment, modalPaymentId]);

  useEffect(() => {
    if (!modalAwaitingPayment) return;
    const timer = setInterval(pollPayment, 5000);
    return () => clearInterval(timer);
  }, [modalAwaitingPayment, pollPayment]);

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
      {(needsPayment || planNeedsPayment) && (
        <div className="p-4 border border-amber-200 bg-amber-50 text-amber-950 rounded-2xl">
          <p className="text-sm font-bold">Assinatura pendente ou vencida</p>
          <p className="text-sm mt-1 text-amber-900/80">
            Para disparar campanhas, escolha um plano abaixo e conclua o pagamento.
          </p>
        </div>
      )}

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
        <span
          className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full border text-xs font-bold ${statusStyle(subData.status)}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {statusLabel(subData.status, subData.renewalDate)}
        </span>
      </div>

      {/* Current plan card */}
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
                ? 'Disparos via WhatsApp oficial da Meta, com limites pensados para começar com segurança.'
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
                {' '}/ {subData.agentsLimit > 100 ? '∞' : subData.agentsLimit} usuários
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
                {isCurrent && !planNeedsPayment ? (
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
                    onClick={() => openCheckoutModal(plan.tier)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      isCurrent && planNeedsPayment
                        ? 'bg-domu-blue text-white hover:bg-blue-700'
                        : plan.popular
                          ? 'bg-domu-blue text-white hover:bg-blue-700'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    {isCurrent && planNeedsPayment
                      ? 'Pagar este plano'
                      : plan.tier === 'STARTER'
                        ? 'Mudar para Starter'
                        : `Ir para ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Checkout Modal ── */}
      {modalOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {modalAwaitingPayment ? 'Aguardando pagamento' : `Assinar plano ${modalPlanData.name}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalAwaitingPayment
                    ? 'Finalize o pagamento para ativar sua assinatura.'
                    : 'Preencha os dados abaixo para gerar a cobrança.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!modalAwaitingPayment ? (
                <>
                  {/* Plan summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Plano</p>
                      <p className="text-sm font-black text-slate-900">{modalPlanData.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900">
                        {modalPriceLabel || `R$ ${modalDisplayPrice}`}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        /mês · recorrência mensal
                      </p>
                    </div>
                  </div>

                  {/* CPF/CNPJ */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-slate-600">
                      CPF ou CNPJ do pagador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={modalCpfCnpj}
                      onChange={(e) => setModalCpfCnpj(e.target.value)}
                      placeholder="Ex: 123.456.789-00 ou 12.345.678/0001-00"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                    />
                  </div>

                  {/* Payment method */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-slate-600">
                      Forma de pagamento
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setModalPaymentMethod('PIX');
                          setModalPriceLabel(null);
                          setModalCouponMsg('');
                          setModalCouponDiscount('');
                        }}
                        className={`p-3 border rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                          modalPaymentMethod === 'PIX'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <QrCode className="w-4 h-4 text-emerald-600" />
                        PIX · −5%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalPaymentMethod('CREDIT_CARD');
                          setModalPriceLabel(null);
                          setModalCouponMsg('');
                          setModalCouponDiscount('');
                        }}
                        className={`p-3 border rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                          modalPaymentMethod === 'CREDIT_CARD'
                            ? 'border-domu-blue bg-blue-50 text-blue-900'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-domu-blue" />
                        Cartão
                      </button>
                    </div>
                    {modalPaymentMethod === 'PIX' && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        Desconto de 5% no PIX. O QR Code será gerado após confirmar.
                      </p>
                    )}
                    {modalPaymentMethod === 'CREDIT_CARD' && (
                      <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        Você será direcionado ao checkout seguro do Asaas para pagar com cartão.
                      </p>
                    )}
                  </div>

                  {/* Coupon */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-slate-600">
                      Cupom de desconto (opcional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={modalCoupon}
                        onChange={(e) => {
                          setModalCoupon(e.target.value.toUpperCase());
                          setModalCouponMsg('');
                          setModalCouponDiscount('');
                        }}
                        placeholder="Ex: DOMU20"
                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl"
                      >
                        Aplicar
                      </button>
                    </div>
                    {modalCouponMsg && (
                      <p className={`text-xs ${modalCouponDiscount ? 'text-emerald-700' : 'text-red-600'}`}>
                        {modalCouponMsg}
                      </p>
                    )}
                  </div>

                  {/* Termos */}
                  <label className="flex items-start gap-3 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalAcceptedTerms}
                      onChange={(e) => setModalAcceptedTerms(e.target.checked)}
                      className="mt-0.5 border-slate-300 text-domu-blue focus:ring-domu-blue"
                    />
                    <span>
                      Li e aceito os{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setLegalModalDoc('terms');
                        }}
                        className="font-semibold text-domu-blue hover:underline"
                      >
                        Termos de Uso
                      </button>{' '}
                      e a{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setLegalModalDoc('privacy');
                        }}
                        className="font-semibold text-domu-blue hover:underline"
                      >
                        Política de Privacidade
                      </button>{' '}
                      da Domu Tech.
                    </span>
                  </label>

                  {/* Error */}
                  {modalError && (
                    <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                      {modalError}
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={modalProcessing}
                    className="w-full py-3 rounded-xl bg-domu-blue text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {modalProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : modalPaymentMethod === 'PIX' ? (
                      <QrCode className="w-4 h-4" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {modalProcessing
                      ? 'Gerando cobrança…'
                      : modalPaymentMethod === 'PIX'
                        ? `Gerar PIX · ${modalPriceLabel || `R$ ${modalDisplayPrice}`}/mês`
                        : `Pagar com cartão · ${modalPriceLabel || `R$ ${modalDisplayPrice}`}/mês`}
                  </button>
                </>
              ) : (
                /* ── Awaiting Payment ── */
                <div className="space-y-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Plano {modalPlanData.name}</p>
                    <p className="text-2xl font-black text-slate-900">
                      {modalPriceLabel || `R$ ${modalDisplayPrice}`}
                      <span className="text-xs text-slate-400 font-semibold">/mês</span>
                    </p>
                  </div>

                  {modalPixPayload && (
                    <div className="space-y-4">
                      {modalPixImage && (
                        <div className="flex justify-center">
                          <img
                            src={`data:image/png;base64,${modalPixImage}`}
                            alt="QR Code PIX"
                            className="w-48 h-48 border border-slate-200 rounded-xl"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase text-slate-600">
                          Código PIX copia e cola
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={modalPixPayload}
                            className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono text-slate-600 truncate"
                          />
                          <button
                            type="button"
                            onClick={copyPix}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {pixCopied ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 text-center">
                        Após pagar, a assinatura ativa automaticamente em alguns segundos.
                      </p>
                    </div>
                  )}

                  {modalInvoiceUrl && modalPaymentMethod === 'CREDIT_CARD' && (
                    <div className="space-y-3">
                      <a
                        href={modalInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 rounded-xl bg-domu-blue text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir checkout do Asaas
                      </a>
                      <p className="text-[11px] text-slate-500 text-center">
                        Conclua o pagamento na página do Asaas. A assinatura ativa automaticamente após confirmação.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Verificando pagamento…
                    </div>
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={manualSyncing}
                      className="text-xs font-bold text-domu-blue hover:underline disabled:opacity-50"
                    >
                      {manualSyncing ? 'Atualizando…' : 'Já paguei — atualizar agora'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <LegalDocumentModal doc={legalModalDoc} onClose={() => setLegalModalDoc(null)} />
    </div>
  );
}
