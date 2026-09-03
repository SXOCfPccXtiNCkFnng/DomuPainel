'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Smartphone, 
  ShieldCheck, 
  Zap,
  MessageCircle,
  QrCode,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Lock,
  Star,
  Key,
  Info,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TenantSegment } from '@/types';
import { SegmentIcon } from '@/components/icons/DomuIcons';
import { syncSessionToStorage } from '@/lib/sessionHelpers';
import { getAuthItem, setAuthItem, syncSessionToActiveStorage } from '@/lib/authStorage';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import {
  formatWhatsAppMask,
  validateCityState,
  validateWhatsAppPhone,
} from '@/lib/onboardingValidation';

const STEPS = [
  { id: 1, label: 'Segmento' },
  { id: 2, label: 'Empresa' },
  { id: 3, label: 'Conexão' },
  { id: 4, label: 'WhatsApp' },
  { id: 5, label: 'Plano' },
] as const;

const PLAN_OPTIONS = [
  {
    id: 'STARTER' as const,
    name: 'Starter',
    tagline: 'MVP completo',
    audience: 'Tudo que o corretor precisa para disparar, qualificar e medir ROI no WhatsApp.',
    price: 197,
    highlight: false,
    features: [
      'Cadastro de imóveis (foto, preço, região, status)',
      'Contatos + tags (interesse, região, faixa)',
      'Campanha: imóvel → segmento → envio',
      'Até 1.500 disparos/mês (limite DOMU)',
      'Até 200 disparos/dia (trava de segurança)',
      'Leads que responderam + métricas de ROI',
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    tagline: 'Mais popular',
    audience: 'Para imobiliárias e equipes que precisam de mais volume e operação diária.',
    price: 497,
    highlight: true,
    features: [
      'Tudo do Starter',
      'Até 6.000 disparos/mês (limite DOMU)',
      'Sem teto diário no portal',
      'Mais usuários na mesma conta',
      'Relatórios avançados de campanha',
      'CRM e atendimento (em breve)',
      'Suporte prioritário DOMU',
    ],
  },
  {
    id: 'ENTERPRISE' as const,
    name: 'Enterprise',
    tagline: 'Alta escala',
    audience: 'Para redes, franquias e operações com volume alto e acompanhamento dedicado.',
    price: 997,
    highlight: false,
    features: [
      'Tudo do Pro',
      'Disparos ilimitados no portal*',
      'Multi-operadores no mesmo canal',
      'API direta / número dedicado',
      'Onboarding assistido pela DOMU',
      'Gerente de conta e SLA',
    ],
  },
];

interface SegmentOption {
  id: TenantSegment;
  title: string;
  badge: string;
  description: string;
  features: string[];
  color: string;
  borderColor: string;
  available: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedSegment, setSelectedSegment] = useState<TenantSegment>('imobiliario');

  // Step 2 Form States
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [cityState, setCityState] = useState('');

  // Step 3 & 4 Config Options
  const [connectionType, setConnectionType] = useState<'COEXISTENCE' | 'DIRECT_API'>('COEXISTENCE');
  const [isConnectedSimulated, setIsConnectedSimulated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Step 5 Pricing Plan States
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PRO' | 'ENTERPRISE'>('STARTER');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [step2Error, setStep2Error] = useState('');
  const [step4Error, setStep4Error] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [appId, setAppId] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);

  const validateStep2 = (): boolean => {
    const trimmedCompany = companyName.trim();
    const trimmedOwner = ownerName.trim();
    const cityCheck = validateCityState(cityState);
    const phoneCheck = validateWhatsAppPhone(whatsappPhone);

    if (!trimmedCompany || !trimmedOwner) {
      setStep2Error('Preencha o nome da empresa e do responsável.');
      return false;
    }

    if (trimmedCompany.length < 2) {
      setStep2Error('Informe um nome de empresa válido.');
      return false;
    }

    if (!cityCheck.ok) {
      setStep2Error(cityCheck.error);
      return false;
    }

    if (!phoneCheck.ok) {
      setStep2Error(phoneCheck.error);
      return false;
    }

    setCityState(cityCheck.formatted);
    setWhatsappPhone(phoneCheck.formatted);
    setStep2Error('');
    return true;
  };

  const handleAdvanceFromStep2 = () => {
    if (!validateStep2()) return;
    const cityCheck = validateCityState(cityState);
    const phoneCheck = validateWhatsAppPhone(whatsappPhone);
    const formattedCity = cityCheck.ok ? cityCheck.formatted : cityState.trim();
    const formattedPhone = phoneCheck.ok ? phoneCheck.formatted : whatsappPhone.trim();

    setAuthItem('domu_company_name', companyName.trim());
    setAuthItem('domu_user_name', ownerName.trim());
    setAuthItem('domu_whatsapp_phone', formattedPhone);
    setAuthItem('domu_city_state', formattedCity);
    setCurrentStep(3);
  };

  useEffect(() => {
    async function verifyOnboardingStatus() {
      const tenantId = getAuthItem('domu_tenant_id');
      if (!tenantId) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/session?tenantId=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          syncSessionToStorage(data);
          if (data.isOnboarded) {
            router.replace('/');
            return;
          }
        }
      } catch {
        // allow onboarding to continue
      }

      setIsCheckingSession(false);
    }

    verifyOnboardingStatus();
  }, [router]);

  const segments: SegmentOption[] = [
    {
      id: 'imobiliario',
      title: 'Setor Imobiliário e Corretores',
      badge: 'Lançamentos e Imóveis',
      description: 'Automação de divulgação de imóveis, busca por perfil compatível e agendamento de visitas.',
      features: [
        'Disparo de lançamentos por faixa de preço',
        'Filtro de leads por bairro e perfil',
        'IA de agendamento de visitas',
      ],
      color: 'text-domu-blue',
      borderColor: 'border-blue-500',
      available: true,
    },
    {
      id: 'marketing_apenas',
      title: 'Apenas Disparo de Mensagens',
      badge: 'Foco Total em Disparos',
      description:
        'Ideal para empresas que desejam focar 100% no disparo de campanhas, aviso de ofertas e atendimento direto no WhatsApp.',
      features: [
        'Envio de campanhas e ofertas em massa',
        'Gestão de opt-in e histórico de mensagens',
        'Sem cadastros complexos de produtos',
      ],
      color: 'text-purple-600',
      borderColor: 'border-purple-500',
      available: true,
    },
    {
      id: 'ecommerce',
      title: 'E-commerce e Varejo',
      badge: 'Vendas Online',
      description: 'Recuperação de carrinho abandonado, lançamento de coleções e rastreio de entregas.',
      features: [
        'Recuperação de compras pendentes',
        'Envio de cupons de desconto VIP',
        'Notificação de produto em estoque',
      ],
      color: 'text-emerald-600',
      borderColor: 'border-emerald-500',
      available: false,
    },
    {
      id: 'saude',
      title: 'Saúde, Clínicas e Beleza',
      badge: 'Agenda e Retornos',
      description:
        'Confirmação de consultas, horários de barbearia e salão, lembretes de retorno e redução de faltas.',
      features: [
        'Confirmação de agenda no WhatsApp',
        'Lembretes de retorno e manutenção',
        'Redução de faltas e no-shows',
      ],
      color: 'text-amber-600',
      borderColor: 'border-amber-500',
      available: false,
    },
    {
      id: 'alimentacao',
      title: 'Pizzarias, Restaurantes e Delivery',
      badge: 'Pedidos e Cardápio',
      description:
        'Receba pedidos, envie cardápio, confirme entregas e fidelize clientes com campanhas no WhatsApp.',
      features: [
        'Cardápio e promoções pelo WhatsApp',
        'Confirmação de pedidos e delivery',
        'Campanhas de fidelização e recompra',
      ],
      color: 'text-orange-600',
      borderColor: 'border-orange-500',
      available: false,
    },
    {
      id: 'geral',
      title: 'Serviços, Jurídico e Outros',
      badge: 'Empresas e Negócios',
      description: 'Lembretes de vencimento, cobrança amigável e atendimento 1:1 ao cliente.',
      features: [
        'Avisos de vencimento de contrato',
        'Cobrança preventiva com PIX',
        'Central multiatendentes no WhatsApp',
      ],
      color: 'text-indigo-600',
      borderColor: 'border-indigo-500',
      available: false,
    },
  ];

  const handleSimulateConnection = async () => {
    setStep4Error('');
    setIsConnecting(true);

    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/onboarding/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          connectionType: 'COEXISTENCE',
          whatsappPhone,
          companyName,
          segment: selectedSegment,
          ownerName,
          cityState,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStep4Error(data.error || 'Não foi possível registrar a conexão.');
        setIsConnecting(false);
        return;
      }

      setAuthItem('domu_whatsapp_phone', whatsappPhone.trim());
      setIsConnectedSimulated(true);
    } catch {
      setStep4Error('Erro ao salvar conexão no servidor. Tente novamente.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveMetaCredentials = async () => {
    setStep4Error('');

    if (!wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim()) {
      setStep4Error('Preencha WABA ID, Phone Number ID e Access Token para continuar.');
      return;
    }

    setIsConnecting(true);

    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/onboarding/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          connectionType: 'DIRECT_API',
          whatsappPhone,
          companyName,
          segment: selectedSegment,
          ownerName,
          cityState,
          wabaId: wabaId.trim(),
          phoneNumberId: phoneNumberId.trim(),
          accessToken: accessToken.trim(),
          verifyToken: verifyToken.trim(),
          appId: appId.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStep4Error(data.error || 'Não foi possível salvar as credenciais Meta.');
        setIsConnecting(false);
        return;
      }

      setAuthItem('domu_whatsapp_phone', whatsappPhone.trim());
      setIsConnectedSimulated(true);
    } catch {
      setStep4Error('Erro ao salvar credenciais no servidor. Tente novamente.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAdvanceFromStep4 = () => {
    if (!isConnectedSimulated) {
      setStep4Error(
        connectionType === 'COEXISTENCE'
          ? 'Conecte o WhatsApp pela Meta antes de continuar.'
          : 'Salve as credenciais da Meta Cloud API antes de continuar.'
      );
      return;
    }
    setStep4Error('');
    setCurrentStep(5);
  };

  const handleFinishOnboarding = async () => {
    if (!acceptedTerms) {
      setTermsError('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }

    setTermsError('');
    setIsProcessingPayment(true);
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          segment: selectedSegment,
          companyName,
          whatsappPhone,
          connectionType,
          selectedPlan,
          paymentMethod,
          ownerName,
          cityState,
          wabaId: wabaId.trim() || undefined,
          phoneNumberId: phoneNumberId.trim() || undefined,
          accessToken: accessToken.trim() || undefined,
          verifyToken: verifyToken.trim() || undefined,
          appId: appId.trim() || undefined,
          acceptedTerms: true,
          termsAcceptedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTermsError(data.error || 'Não foi possível ativar o plano. Tente novamente.');
        setIsProcessingPayment(false);
        return;
      }

      const finalTenantId = data.tenantId || storedTenantId;

      syncSessionToActiveStorage({
        domu_is_logged_in: 'true',
        domu_is_onboarded: 'true',
        domu_selected_segment: selectedSegment,
        domu_terms_accepted: 'true',
        domu_tenant_id: finalTenantId,
        ...(companyName ? { domu_company_name: companyName.trim() } : {}),
        ...(ownerName ? { domu_user_name: ownerName.trim() } : {}),
        ...(whatsappPhone ? { domu_whatsapp_phone: whatsappPhone.trim() } : {}),
      });

      if (finalTenantId) {
        syncSessionToStorage({
          isOnboarded: true,
          segment: selectedSegment,
          companyName: companyName || 'Empresa DOMU',
          tenantId: finalTenantId,
        });
      }

      setIsProcessingPayment(false);
      router.replace('/');
    } catch (err) {
      console.error('Erro ao salvar onboarding no Supabase:', err);
      setTermsError('Erro de conexão ao ativar o plano. Tente novamente.');
      setIsProcessingPayment(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-domu-blue/20 border-t-domu-blue rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Verificando sua conta...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 py-4 px-4 sm:px-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo-com-nome.png" 
                alt="Domu Tech Logo" 
                width={160} 
                height={38} 
                className="h-9 w-auto object-contain"
              />
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-sm font-semibold text-slate-600 hidden sm:inline">Configuração inicial</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-domu-blue">
              Passo {currentStep} de 5
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            {STEPS.map((step) => (
              <React.Fragment key={step.id}>
                <div className="flex-1 min-w-0">
                  <div
                    className={`h-1 transition-colors ${
                      step.id <= currentStep ? 'bg-domu-blue' : 'bg-slate-200'
                    }`}
                  />
                  <p
                    className={`mt-1.5 text-[11px] font-semibold truncate hidden sm:block ${
                      step.id === currentStep ? 'text-domu-blue' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-10 space-y-8">
        
        {/* STEP 1: Segment Selection */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-domu-blue border border-blue-100">
                Passo 1 · Segmento
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Qual é o foco do seu negócio?
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">
                Escolha o perfil que melhor representa sua operação. O portal adapta templates, automações e ferramentas para o seu dia a dia.
              </p>
            </div>

            {/* Segment Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {segments.map((seg) => {
                const isSelected = selectedSegment === seg.id;
                const isLocked = !seg.available;

                return (
                  <div
                    key={seg.id}
                    onClick={() => {
                      if (!isLocked) setSelectedSegment(seg.id);
                    }}
                    className={`p-4 sm:p-5 border-2 transition-all space-y-3 relative bg-white ${
                      isLocked
                        ? 'border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? `${seg.borderColor} shadow-sm cursor-pointer`
                          : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    {isLocked ? (
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wide">
                        <Lock className="w-3 h-3" />
                        Em breve
                      </div>
                    ) : isSelected ? (
                      <div className="absolute top-4 right-4 bg-domu-blue text-white p-1">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : null}

                    <div className="flex items-center gap-3 pr-20">
                      <SegmentIcon segment={seg.id} />
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{seg.title}</h3>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{seg.badge}</span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {seg.description}
                    </p>

                    <div className="pt-3 border-t border-slate-100 space-y-1.5">
                      {seg.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-500">
                          <Check className={`w-3 h-3 shrink-0 ${isLocked ? 'text-slate-400' : 'text-emerald-600'}`} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Banner: Pedir Novo Segmento Personalizado */}
            <div className="p-5 bg-[#0B132B] text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Não encontrou o seu perfil?</h4>
                  <p className="text-sm text-slate-400">Fale com nossa equipe e montamos um segmento sob medida.</p>
                </div>
              </div>

              <a
                href="https://wa.me/5511934430659?text=Olá!%20Gostaria%20de%20solicitar%20um%20segmento%20personalizado%20no%20Portal%20DOMU%20Tech"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shrink-0 flex items-center justify-center gap-2"
              >
                <span>Falar com a DOMU</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCurrentStep(2)}
                className="btn-domu-primary text-sm py-3 px-6 flex items-center gap-2"
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Company Details */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-3">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-domu-blue border border-blue-100">
                Passo 2 · Empresa
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Dados da sua empresa
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">
                Usamos essas informações para personalizar mensagens, relatórios e o painel do portal.
              </p>
            </div>

            <div className="bg-white p-6 border border-slate-200 space-y-4">
              {step2Error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                  {step2Error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nome da Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (step2Error) setStep2Error('');
                  }}
                  className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 bg-white text-slate-900 placeholder-slate-400"
                  placeholder="Nome da sua empresa"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nome do Responsável <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => {
                      setOwnerName(e.target.value);
                      if (step2Error) setStep2Error('');
                    }}
                    className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Cidade / Estado <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cityState}
                    onChange={(e) => {
                      setCityState(e.target.value);
                      if (step2Error) setStep2Error('');
                    }}
                    onBlur={() => {
                      const check = validateCityState(cityState);
                      if (check.ok) setCityState(check.formatted);
                    }}
                    className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                    placeholder="Ex: São Paulo, SP"
                    autoComplete="address-level2"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Use cidade + UF. Ex: Curitiba, PR
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  WhatsApp para disparos e atendimento <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  value={whatsappPhone}
                  onChange={(e) => {
                    setWhatsappPhone(formatWhatsAppMask(e.target.value));
                    if (step2Error) setStep2Error('');
                  }}
                  className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  autoComplete="tel-national"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Somente número brasileiro com DDD
                </p>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleAdvanceFromStep2}
                className="btn-domu-primary text-sm py-3 px-6 flex items-center gap-2"
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Connection Type Selection */}
        {currentStep === 3 && (
          <div className="space-y-7 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-3">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-domu-blue border border-blue-100">
                Passo 3 · Conexão
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Como você quer usar o WhatsApp?
              </h1>
              <p className="text-base text-slate-500 leading-relaxed max-w-xl mx-auto">
                Escolha o modelo que combina com a sua operação. A maioria das empresas começa pela coexistência oficial.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Coexistence */}
              <button
                type="button"
                onClick={() => {
                  setConnectionType('COEXISTENCE');
                  setIsConnectedSimulated(false);
                  setStep4Error('');
                }}
                className={`text-left p-6 border-2 transition-all space-y-4 bg-white relative ${
                  connectionType === 'COEXISTENCE'
                    ? 'border-domu-blue shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {connectionType === 'COEXISTENCE' && (
                  <div className="absolute top-4 right-4 bg-domu-blue text-white p-1">
                    <Check className="w-4 h-4" />
                  </div>
                )}

                <div className="flex items-start gap-3 pr-8">
                  <div className="w-11 h-11 border border-blue-100 bg-blue-50 text-domu-blue flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
                      Recomendado
                    </p>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      Continuar com seu WhatsApp atual
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">
                      Coexistência oficial Meta
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Use o WhatsApp Business no celular normalmente e dispare campanhas pelo portal no mesmo número.
                </p>

                <ul className="space-y-2 pt-1 border-t border-slate-100">
                  {[
                    'Mantém seu número atual',
                    'Histórico e conversas no celular',
                    'Ideal para a maioria das empresas',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </button>

              {/* Direct API */}
              <button
                type="button"
                onClick={() => {
                  setConnectionType('DIRECT_API');
                  setIsConnectedSimulated(false);
                  setStep4Error('');
                }}
                className={`text-left p-6 border-2 transition-all space-y-4 bg-white relative ${
                  connectionType === 'DIRECT_API'
                    ? 'border-domu-blue shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {connectionType === 'DIRECT_API' && (
                  <div className="absolute top-4 right-4 bg-domu-blue text-white p-1">
                    <Check className="w-4 h-4" />
                  </div>
                )}

                <div className="flex items-start gap-3 pr-8">
                  <div className="w-11 h-11 border border-indigo-100 bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                      Alta escala
                    </p>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      Número dedicado para automação
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">
                      API direta Meta Cloud
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Número exclusivo para disparos e atendimento em volume, pensado para operações maiores e vários atendentes.
                </p>

                <ul className="space-y-2 pt-1 border-t border-slate-100">
                  {[
                    'Número separado para alto volume',
                    'Vários operadores no mesmo canal',
                    'Melhor para operações corporativas',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </button>
            </div>

            {/* Summary */}
            <div className="bg-[#0B132B] text-white p-5 border border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold">Resumo da configuração</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Segmento</p>
                  <p className="font-semibold text-blue-300">
                    {SEGMENT_LABELS[selectedSegment] || selectedSegment}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Empresa</p>
                  <p className="font-semibold text-white truncate">{companyName || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">WhatsApp</p>
                  <p className="font-semibold text-white">{whatsappPhone || '—'}</p>
                </div>
              </div>
              <p className="mt-3 pt-3 border-t border-slate-700 text-sm text-slate-400">
                Modelo escolhido:{' '}
                <strong className="text-white">
                  {connectionType === 'COEXISTENCE'
                    ? 'Continuar com WhatsApp atual'
                    : 'Número dedicado (API Direta)'}
                </strong>
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="btn-domu-primary text-sm py-3 px-6 flex items-center gap-2"
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: WhatsApp Connection */}
        {currentStep === 4 && (
          <div className="space-y-7 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-3">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-domu-blue border border-blue-100">
                Passo 4 · WhatsApp
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                {connectionType === 'COEXISTENCE'
                  ? 'Conecte seu WhatsApp Business'
                  : 'Configure a Meta Cloud API'}
              </h1>
              <p className="text-base text-slate-500 leading-relaxed max-w-xl mx-auto">
                {connectionType === 'COEXISTENCE'
                  ? 'Fluxo oficial de coexistência da Meta: você autoriza o número atual e continua usando o app no celular.'
                  : 'Informe as credenciais do Meta Business Manager para vincular o número dedicado de API.'}
              </p>
            </div>

            {step4Error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                {step4Error}
              </div>
            )}

            {!isConnectedSimulated ? (
              connectionType === 'COEXISTENCE' ? (
                <div className="bg-white border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-5">
                    <div className="lg:col-span-3 p-6 sm:p-8 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-blue-50 border border-blue-100 text-domu-blue flex items-center justify-center">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Coexistência oficial</h3>
                          <p className="text-sm text-slate-500">Mesmo número no celular e no portal</p>
                        </div>
                      </div>

                      <ol className="space-y-3">
                        {[
                          'Tenha o WhatsApp Business instalado no celular com o número informado.',
                          'Clique em “Conectar com Meta” e autorize no Facebook Business / Meta.',
                          'Confirme a coexistência no app do celular quando a Meta solicitar.',
                          'Volte aqui: o canal fica pronto para disparos e atendimento.',
                        ].map((step, idx) => (
                          <li key={step} className="flex gap-3 text-sm text-slate-600">
                            <span className="w-6 h-6 shrink-0 bg-[#0B132B] text-white text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>

                      <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 text-sm text-slate-600">
                        <Info className="w-4 h-4 text-domu-blue shrink-0 mt-0.5" />
                        <p>
                          Número a vincular:{' '}
                          <strong className="text-slate-900">{whatsappPhone || '—'}</strong>
                          . Em produção, esta etapa abre o Embedded Signup oficial da Meta.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSimulateConnection}
                        disabled={isConnecting}
                        className="w-full btn-domu-primary text-sm py-3 justify-center disabled:opacity-50"
                      >
                        {isConnecting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Autorizando com a Meta...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4" />
                            Conectar com Meta
                          </>
                        )}
                      </button>
                    </div>

                    <div className="lg:col-span-2 p-6 sm:p-8 bg-[#0B132B] text-white flex flex-col items-center justify-center gap-4">
                      <div className="w-40 h-40 bg-white p-3 flex items-center justify-center">
                        <QrCode className="w-full h-full text-slate-900" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold">Prévia do pareamento</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          A Meta pode pedir confirmação no celular após a autorização do Business Manager.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 p-6 sm:p-8 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Credenciais Meta Cloud API</h3>
                      <p className="text-sm text-slate-500">
                        Dados do Meta Business Manager · Graph API
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 text-sm text-indigo-900">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      Encontre esses IDs em{' '}
                      <strong>developers.facebook.com</strong> → seu app WhatsApp → API Setup.
                      O Access Token será criptografado antes de salvar no Supabase.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        WhatsApp Business Account ID (WABA) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                        placeholder="Ex: 102938475610293"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Phone Number ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                        placeholder="Ex: 109848492049281"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Access Token permanente <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showAccessToken ? 'text' : 'password'}
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          className="w-full px-3 py-3 pr-10 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                          placeholder="EAAG..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccessToken(!showAccessToken)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        App ID <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                        placeholder="Meta App ID"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Verify Token <span className="text-slate-400 font-normal">(webhook)</span>
                      </label>
                      <input
                        type="text"
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-200 text-base focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                        placeholder="Gerado automaticamente se vazio"
                      />
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100 text-sm text-slate-500">
                    Número informado no passo anterior:{' '}
                    <strong className="text-slate-800">{whatsappPhone || '—'}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveMetaCredentials}
                    disabled={isConnecting}
                    className="w-full btn-domu-primary text-sm py-3 justify-center disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Salvando no Supabase...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Validar e salvar credenciais
                      </>
                    )}
                  </button>
                </div>
              )
            ) : (
              <div className="bg-white border border-emerald-200 p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">
                    {connectionType === 'COEXISTENCE'
                      ? 'WhatsApp conectado com sucesso'
                      : 'Credenciais Meta salvas com sucesso'}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    {connectionType === 'COEXISTENCE'
                      ? `O número ${whatsappPhone} foi vinculado via coexistência oficial e registrado no Supabase.`
                      : `WABA ${wabaId} e Phone Number ID ${phoneNumberId} foram salvos com token criptografado no Supabase.`}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Canal pronto para o próximo passo
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsConnectedSimulated(false);
                  setStep4Error('');
                  setCurrentStep(3);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleAdvanceFromStep4}
                className="btn-domu-primary text-sm py-3 px-6 flex items-center gap-2 disabled:opacity-50"
                disabled={!isConnectedSimulated}
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Pricing Plan & Payment Selection */}
        {currentStep === 5 && (() => {
          const activePlan = PLAN_OPTIONS.find((p) => p.id === selectedPlan) || PLAN_OPTIONS[1];
          const pixPrice = Math.round(activePlan.price * 0.95);

          return (
          <div className="space-y-7 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-domu-blue border border-blue-100">
                Passo 5 · Plano
              </span>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Escolha o plano da sua operação
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">
                Valores alinhados ao uso real do portal hoje: disparos, templates, coexistência Meta e evolução para CRM.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {PLAN_OPTIONS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const isPro = plan.highlight;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`text-left p-6 border-2 transition-all flex flex-col relative ${
                      isPro
                        ? isSelected
                          ? 'bg-[#0B132B] text-white border-domu-blue shadow-lg'
                          : 'bg-[#0B132B] text-white border-slate-700 hover:border-slate-500'
                        : isSelected
                          ? 'bg-white border-domu-blue shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isPro && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-domu-blue text-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                        Recomendado
                      </span>
                    )}

                    {isSelected && !isPro && (
                      <span className="absolute top-4 right-4 bg-domu-blue text-white p-1">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                    {isSelected && isPro && (
                      <span className="absolute top-4 right-4 bg-domu-blue text-white p-1">
                        <Check className="w-4 h-4" />
                      </span>
                    )}

                    <div className="space-y-4 flex-1">
                      <div>
                        <p
                          className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${
                            isPro ? 'text-blue-300' : 'text-slate-400'
                          }`}
                        >
                          {plan.tagline}
                        </p>
                        <h3 className={`text-xl font-bold ${isPro ? 'text-white' : 'text-slate-900'}`}>
                          {plan.name}
                        </h3>
                        <p className={`text-sm mt-2 leading-relaxed ${isPro ? 'text-slate-300' : 'text-slate-500'}`}>
                          {plan.audience}
                        </p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-bold tracking-tight ${isPro ? 'text-white' : 'text-slate-900'}`}>
                          R$ {plan.price}
                        </span>
                        <span className={`text-sm font-medium ${isPro ? 'text-slate-400' : 'text-slate-400'}`}>
                          /mês
                        </span>
                      </div>

                      <ul
                        className={`space-y-2.5 pt-4 border-t ${
                          isPro ? 'border-slate-700' : 'border-slate-100'
                        }`}
                      >
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className={`flex items-start gap-2 text-sm ${
                              isPro ? 'text-slate-200' : 'text-slate-600'
                            }`}
                          >
                            <Check
                              className={`w-4 h-4 mt-0.5 shrink-0 ${
                                isPro ? 'text-blue-400' : 'text-emerald-600'
                              }`}
                            />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div
                      className={`mt-6 w-full py-2.5 text-center text-sm font-bold border ${
                        isSelected
                          ? 'bg-domu-blue text-white border-domu-blue'
                          : isPro
                            ? 'bg-slate-800 text-slate-200 border-slate-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {isSelected ? 'Plano selecionado' : `Escolher ${plan.name}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-400 text-center">
              *Limites DOMU do plano. O envio também respeita qualidade e tier da Meta Cloud API — trocar para API dedicada não aumenta sozinho o teto da Meta.
            </p>

            <div className="bg-white border border-slate-200 p-6 space-y-5 max-w-2xl mx-auto">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Forma de pagamento</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Plano {activePlan.name} · cobrança mensal
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    {paymentMethod === 'PIX' ? 'Com PIX' : 'No cartão'}
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    R$ {paymentMethod === 'PIX' ? pixPrice : activePlan.price}
                    <span className="text-sm font-medium text-slate-400">/mês</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PIX')}
                  className={`p-3 border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                    paymentMethod === 'PIX'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  PIX · −5%
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`p-3 border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'border-domu-blue bg-blue-50 text-blue-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-domu-blue" />
                  Cartão
                </button>
              </div>

              {paymentMethod === 'PIX' ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-sm text-emerald-900 space-y-1">
                  <p className="font-semibold">Desconto de 5% no PIX aplicado</p>
                  <p className="text-emerald-800/80">
                    De R$ {activePlan.price} por <strong>R$ {pixPrice}/mês</strong>. Ativação imediata para teste neste ambiente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Número do cartão"
                    defaultValue="4532 •••• •••• 8892"
                    className="col-span-2 px-3 py-2.5 border border-slate-200 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="MM/AA"
                    defaultValue="08/29"
                    className="px-3 py-2.5 border border-slate-200 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="CVV"
                    defaultValue="782"
                    className="px-3 py-2.5 border border-slate-200 text-sm"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (e.target.checked) setTermsError('');
                    }}
                    className="mt-0.5 border-slate-300 text-domu-blue focus:ring-domu-blue"
                  />
                  <span>
                    Li e aceito os{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
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
                        setShowTermsModal(true);
                      }}
                      className="font-semibold text-domu-blue hover:underline"
                    >
                      Política de Privacidade
                    </button>{' '}
                    da Domu Tech.
                  </span>
                </label>
                {termsError && (
                  <p className="text-sm text-red-600">{termsError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isProcessingPayment || !acceptedTerms}
                className="btn-domu-primary text-sm py-3 px-6 flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Ativando plano...</span>
                  </>
                ) : (
                  <>
                    <span>Ativar {activePlan.name} e entrar</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
          );
        })()}

      </main>

      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Termos de Uso e Privacidade</h3>
                <p className="text-sm text-slate-500">Domu Tech</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
              <section className="space-y-2">
                <h4 className="font-bold text-slate-900">1. Objeto</h4>
                <p>
                  O Portal Domu Tech oferece ferramentas de disparo, automação e gestão de atendimento via WhatsApp
                  utilizando a Meta Cloud API oficial, sob responsabilidade do contratante quanto ao uso dos dados
                  e ao cumprimento das regras da Meta e da LGPD.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="font-bold text-slate-900">2. Conta e responsabilidade</h4>
                <p>
                  O usuário declara ser responsável pelas informações cadastradas, pelos contatos importados e pelo
                  conteúdo das mensagens enviadas. É obrigatório obter opt-in válido antes de disparos comerciais.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="font-bold text-slate-900">3. Dados e privacidade</h4>
                <p>
                  Tratamos dados de conta, empresa, WhatsApp e métricas de campanha para operação do serviço.
                  Credenciais da Meta são armazenadas de forma criptografada. Não vendemos dados de clientes a terceiros.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="font-bold text-slate-900">4. Planos e cobrança</h4>
                <p>
                  A assinatura é mensal conforme o plano escolhido. Limites de disparo e recursos seguem a tabela
                  vigente. Taxas da Meta (conversas/templates) são de responsabilidade do contratante junto à Meta.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="font-bold text-slate-900">5. Uso aceitável</h4>
                <p>
                  É proibido spam, conteúdo ilegal, phishing ou qualquer prática que viole as políticas do WhatsApp
                  Business Platform. Contas que gerarem risco de bloqueio poderão ser suspensas.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="font-bold text-slate-900">6. Aceite</h4>
                <p>
                  Ao marcar a opção de aceite e ativar o plano, você confirma que leu e concorda com estes Termos
                  de Uso e com a Política de Privacidade da Domu Tech.
                </p>
              </section>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setTermsError('');
                  setShowTermsModal(false);
                }}
                className="btn-domu-primary text-sm py-2.5 px-5"
              >
                Aceitar e continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
