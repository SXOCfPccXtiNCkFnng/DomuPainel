'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  ShoppingBag, 
  Stethoscope, 
  Briefcase, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Smartphone, 
  ShieldCheck, 
  Zap,
  Send,
  MessageCircle,
  QrCode,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Lock,
  Star
} from 'lucide-react';
import { TenantSegment } from '@/types';

interface SegmentOption {
  id: TenantSegment;
  title: string;
  badge: string;
  description: string;
  features: string[];
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedSegment, setSelectedSegment] = useState<TenantSegment>('imobiliario');

  // Step 2 Form States
  const [companyName, setCompanyName] = useState('DOMU Imóveis & Soluções');
  const [ownerName, setOwnerName] = useState('Alan Felipe');
  const [whatsappPhone, setWhatsappPhone] = useState('(11) 93443-0659');
  const [cityState, setCityState] = useState('São Paulo, SP');

  // Step 3 & 4 Config Options
  const [connectionType, setConnectionType] = useState<'COEXISTENCE' | 'DIRECT_API'>('COEXISTENCE');
  const [isConnectedSimulated, setIsConnectedSimulated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Step 5 Pricing Plan States
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PRO' | 'ENTERPRISE'>('PRO');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const segments: SegmentOption[] = [
    {
      id: 'imobiliario',
      title: 'Setor Imobiliário & Corretores',
      badge: 'Lançamentos & Imóveis',
      description: 'Automação de divulgação de imóveis, busca por perfil compatível e agendamento de visitas.',
      features: ['Disparo de lançamentos por faixa de preço', 'Filtro de leads por bairro e perfil', 'IA de agendamento de visitas'],
      icon: Building2,
      color: 'text-domu-blue',
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-50/50'
    },
    {
      id: 'ecommerce',
      title: 'E-commerce & Varejo',
      badge: 'Vendas Online',
      description: 'Recuperação de carrinho abandonado, lançamento de coleções e rastreio de entregas.',
      features: ['Recuperação de compras pendentes', 'Envio de cupons de desconto VIP', 'Notificação de produto em estoque'],
      icon: ShoppingBag,
      color: 'text-emerald-600',
      borderColor: 'border-emerald-500',
      bgColor: 'bg-emerald-50/50'
    },
    {
      id: 'saude',
      title: 'Saúde & Clínicas',
      badge: 'Agendamentos',
      description: 'Confirmação automática de consultas, lembretes de retorno e alertas de exames.',
      features: ['Confirmação de agenda no WhatsApp', 'Instruções pré-exame automatizadas', 'Redução de faltas em até 80%'],
      icon: Stethoscope,
      color: 'text-amber-600',
      borderColor: 'border-amber-500',
      bgColor: 'bg-amber-50/50'
    },
    {
      id: 'marketing_apenas',
      title: 'Apenas Disparo de Mensagens (Sem Módulos)',
      badge: 'Foco Total em Disparos',
      description: 'Ideal para empresas que desejam focar 100% no disparo de campanhas, aviso de ofertas e atendimento direto no WhatsApp, sem módulos específicos.',
      features: ['Envio de campanhas e ofertas em massa', 'Gestão de opt-in e histórico de mensagens', 'Sem cadastros complexos de produtos'],
      icon: Send,
      color: 'text-purple-600',
      borderColor: 'border-purple-500',
      bgColor: 'bg-purple-50/50'
    },
    {
      id: 'geral',
      title: 'Serviços, Jurídico & Outros',
      badge: 'Empresas & Negócios',
      description: 'Lembretes de vencimento, cobrança amigável e atendimento 1:1 ao cliente.',
      features: ['Avisos de vencimento de contrato', 'Cobrança preventiva com PIX', 'Central multiatendentes no WhatsApp'],
      icon: Briefcase,
      color: 'text-indigo-600',
      borderColor: 'border-indigo-500',
      bgColor: 'bg-indigo-50/50'
    }
  ];

  const handleSimulateConnection = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnectedSimulated(true);
    }, 1200);
  };

  const handleFinishOnboarding = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      localStorage.setItem('domu_is_onboarded', 'true');
      setIsProcessingPayment(false);
      router.push('/');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-4 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <Image 
            src="/logo-com-nome.png" 
            alt="DOMU Tech Logo" 
            width={130} 
            height={30} 
            className="h-6 w-auto object-contain"
          />
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">|</span>
          <span className="text-xs font-bold text-slate-600 hidden sm:inline">Onboarding do Portal</span>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold overflow-x-auto max-w-full pb-1 sm:pb-0">
          <div className={`px-2.5 py-1 rounded-full ${currentStep === 1 ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
            <span>1. Segmento</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`px-2.5 py-1 rounded-full ${currentStep === 2 ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
            <span>2. Empresa</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`px-2.5 py-1 rounded-full ${currentStep === 3 ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
            <span>3. Tipo</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`px-2.5 py-1 rounded-full ${currentStep === 4 ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
            <span>4. Conexão</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`px-2.5 py-1 rounded-full ${currentStep === 5 ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
            <span>5. Plano</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-10 space-y-8">
        
        {/* STEP 1: Segment Selection */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-domu-blue border border-blue-200">
                Passo 1 de 5
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Selecione o Segmento do seu Negócio
              </h1>
              <p className="text-xs text-slate-500">
                O Portal DOMU Tech personaliza as ferramentas, modelos de disparo e automações para atender o seu nicho.
              </p>
            </div>

            {/* Segment Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {segments.map((seg) => {
                const IconComponent = seg.icon;
                const isSelected = selectedSegment === seg.id;

                return (
                  <div
                    key={seg.id}
                    onClick={() => setSelectedSegment(seg.id)}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all space-y-3 relative bg-white ${
                      isSelected 
                        ? `${seg.borderColor} shadow-md ring-2 ring-blue-500/20` 
                        : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-4 right-4 bg-domu-blue text-white rounded-full p-1 shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${seg.bgColor} flex items-center justify-center border border-slate-200/60`}>
                        <IconComponent className={`w-5 h-5 ${seg.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900">{seg.title}</h3>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">{seg.badge}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {seg.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      {seg.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Banner: Pedir Novo Segmento Personalizado */}
            <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Não encontrou o segmento da sua empresa?</h4>
                  <p className="text-[11px] text-slate-400">Solicite um segmento exclusivo para o seu nicho com nossa equipe técnica.</p>
                </div>
              </div>

              <a
                href="https://wa.me/5511934430659?text=Olá!%20Gostaria%20de%20solicitar%20um%20segmento%20personalizado%20no%20Portal%20DOMU%20Tech"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shrink-0 flex items-center justify-center gap-2"
              >
                <span>Solicitar Novo Segmento</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Step 1 Actions */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCurrentStep(2)}
                className="btn-domu-primary text-xs py-2.5 px-6 shadow-md flex items-center gap-2"
              >
                <span>Avançar para Dados da Empresa</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Company Details */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-domu-blue border border-blue-200">
                Passo 2 de 5
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Dados da sua Empresa & Marca
              </h1>
              <p className="text-xs text-slate-500">
                Informe o nome comercial da sua empresa e contatos para personalizar o cabeçalho das mensagens.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Comercial da Empresa / Imobiliária
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex: DOMU Imóveis & Consultoria"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Seu Nome"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cidade / Estado
                  </label>
                  <input
                    type="text"
                    value={cityState}
                    onChange={(e) => setCityState(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Ex: São Paulo, SP"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Oficial para Disparos e Atendimento
                </label>
                <input
                  type="text"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                onClick={() => setCurrentStep(3)}
                className="btn-domu-primary text-xs py-2.5 px-6 shadow-md flex items-center gap-2"
              >
                <span>Avançar para Tipo de Conexão</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Connection Type Selection */}
        {currentStep === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Passo 3 de 5 — Tipo de Conexão
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Como deseja conectar seu WhatsApp?
              </h1>
              <p className="text-xs text-slate-500">
                O DOMU Tech oferece a tecnologia de Coexistência Oficial para você manter seu aplicativo de celular funcionando junto com a automação.
              </p>
            </div>

            {/* Connection Type Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div
                onClick={() => setConnectionType('COEXISTENCE')}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all space-y-3 bg-white ${
                  connectionType === 'COEXISTENCE'
                    ? 'border-domu-blue shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-domu-blue" />
                  <h3 className="text-sm font-black text-slate-900">Coexistência Oficial</h3>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Mantenha o aplicativo WhatsApp Business no celular funcionando normalmente enquanto o Portal DOMU envia as automações em massa.
                </p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 block w-fit">
                  ✓ Recomendado (Mantém seu número atual)
                </span>
              </div>

              <div
                onClick={() => setConnectionType('DIRECT_API')}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all space-y-3 bg-white ${
                  connectionType === 'DIRECT_API'
                    ? 'border-domu-blue shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">API Direta</h3>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Conexão direta com número dedicado de API exclusivo para grandes volumes e múltiplos operadores no mesmo canal.
                </p>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded block w-fit">
                  Para alta escala corporativa
                </span>
              </div>

            </div>

            {/* Summary Box */}
            <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h4 className="font-extrabold">Resumo da Configuração:</h4>
              </div>
              <p className="text-slate-300">
                Segmento: <strong className="text-blue-400 capitalize">{selectedSegment}</strong> • Empresa: <strong>{companyName}</strong> • Telefone: <strong>{whatsappPhone}</strong>
              </p>
            </div>

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                onClick={() => setCurrentStep(4)}
                className="btn-domu-primary text-xs py-2.5 px-6 shadow-md flex items-center gap-2"
              >
                <span>Avançar para Vinculação do WhatsApp</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Symbolic WhatsApp QR Code / Connection Simulation */}
        {currentStep === 4 && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-domu-blue border border-blue-200">
                Passo 4 de 5 — Conexão Simbólica
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Vincule seu WhatsApp ao Portal DOMU Tech
              </h1>
              <p className="text-xs text-slate-500">
                {connectionType === 'COEXISTENCE' 
                  ? 'Abra o WhatsApp no celular > Aparelhos Conectados > Conectar um Aparelho' 
                  : 'Insira o Token de Acesso da Meta Cloud API para autenticar seu canal de produção'}
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md text-center space-y-6">
              
              {!isConnectedSimulated ? (
                <div className="space-y-6">
                  {/* Symbolic QR Code Box */}
                  <div className="relative w-56 h-56 mx-auto bg-slate-950 p-4 rounded-2xl border-2 border-slate-800 shadow-xl flex items-center justify-center group overflow-hidden">
                    
                    {/* Decorative Scanning Laser Effect */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent top-0 animate-bounce"></div>

                    {/* QR Code Illustration */}
                    <div className="bg-white p-3 rounded-xl shadow-inner flex flex-col items-center justify-center">
                      <QrCode className="w-36 h-36 text-slate-900" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-800">
                      {isConnecting ? 'Verificando e sincronizando chave com o WhatsApp...' : 'Aguardando leitura do QR Code / Autenticação do Número'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Número identificado: <strong className="text-domu-blue">{whatsappPhone}</strong>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={handleSimulateConnection}
                      disabled={isConnecting}
                      className="w-full sm:w-auto btn-domu-primary text-xs py-2.5 px-6 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Conectando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Simular Conexão Efetuada</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Connected State Success Banner */
                <div className="py-6 space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-50">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-900">WhatsApp Conectado com Sucesso!</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      O número <strong className="text-slate-900">{whatsappPhone}</strong> foi vinculado via {connectionType === 'COEXISTENCE' ? 'Coexistência Oficial' : 'API Direta'}.
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Canal de Disparos Ativo & Pronto</span>
                  </span>
                </div>
              )}

            </div>

            {/* Step 4 Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                onClick={() => setCurrentStep(5)}
                className="btn-domu-primary text-xs py-2.5 px-6 shadow-md flex items-center gap-2"
              >
                <span>Avançar para Escolha do Plano</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Pricing Plan & Payment Selection */}
        {currentStep === 5 && (
          <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                Passo 5 de 5 — Plano & Assinatura
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Escolha o Plano Ideal para seu Negócio
              </h1>
              <p className="text-xs text-slate-500">
                Selecione a assinatura para liberar acesso imediato ao Portal DOMU Tech e iniciar suas automações.
              </p>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              
              {/* Plan Starter */}
              <div 
                onClick={() => setSelectedPlan('STARTER')}
                className={`bg-white p-6 rounded-2xl border-2 transition-all space-y-4 relative cursor-pointer flex flex-col justify-between ${
                  selectedPlan === 'STARTER' ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Plano Starter</h3>
                    <p className="text-[11px] text-slate-500">Para pequenos negócios e corretores autônomos</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">R$ 197</span>
                    <span className="text-xs text-slate-400 font-semibold">/mês</span>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Até 2.500 mensagens/mês</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>1 Número WhatsApp Conectado</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Disparos em Lote & Relatórios</span>
                    </li>
                  </ul>
                </div>

                <div className={`mt-4 w-full py-2 rounded-lg text-center text-xs font-extrabold border ${
                  selectedPlan === 'STARTER' ? 'bg-domu-blue text-white border-domu-blue' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {selectedPlan === 'STARTER' ? 'Plano Selecionado ✓' : 'Selecionar Starter'}
                </div>
              </div>

              {/* Plan PRO (Featured) */}
              <div 
                onClick={() => setSelectedPlan('PRO')}
                className={`bg-slate-900 text-white p-6 rounded-2xl border-2 transition-all space-y-4 relative cursor-pointer shadow-xl flex flex-col justify-between ${
                  selectedPlan === 'PRO' ? 'border-blue-400 ring-2 ring-blue-400/30' : 'border-slate-800'
                }`}
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                  <span>Mais Popular</span>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <h3 className="text-sm font-black text-white">Plano Pro</h3>
                    <p className="text-[11px] text-slate-400">Para imobiliárias e empresas em expansão</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">R$ 497</span>
                    <span className="text-xs text-slate-400 font-semibold">/mês</span>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span><strong>Disparos Ilimitados</strong> (limite Meta)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Coexistência Oficial no Celular</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>IA de Qualificação de Leads</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Suporte Prioritário VIP</span>
                    </li>
                  </ul>
                </div>

                <div className={`mt-4 w-full py-2.5 rounded-lg text-center text-xs font-extrabold ${
                  selectedPlan === 'PRO' ? 'bg-domu-blue text-white shadow-md' : 'bg-slate-800 text-slate-200'
                }`}>
                  {selectedPlan === 'PRO' ? 'Plano Selecionado ✓' : 'Selecionar Pro'}
                </div>
              </div>

              {/* Plan Enterprise */}
              <div 
                onClick={() => setSelectedPlan('ENTERPRISE')}
                className={`bg-white p-6 rounded-2xl border-2 transition-all space-y-4 relative cursor-pointer flex flex-col justify-between ${
                  selectedPlan === 'ENTERPRISE' ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Plano Enterprise</h3>
                    <p className="text-[11px] text-slate-500">Para grandes operações e redes corporativas</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">R$ 997</span>
                    <span className="text-xs text-slate-400 font-semibold">/mês</span>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Múltiplos Operadores no mesmo WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>API Direta Dedicada de Alta Escala</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Gerente de Conta Exclusivo & SLA</span>
                    </li>
                  </ul>
                </div>

                <div className={`mt-4 w-full py-2 rounded-lg text-center text-xs font-extrabold border ${
                  selectedPlan === 'ENTERPRISE' ? 'bg-domu-blue text-white border-domu-blue' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {selectedPlan === 'ENTERPRISE' ? 'Plano Selecionado ✓' : 'Selecionar Enterprise'}
                </div>
              </div>

            </div>

            {/* Payment Method Selector */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider text-center">
                Forma de Pagamento da Mensalidade
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PIX')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'PIX' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>PIX (Aprovação Instantânea)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'CREDIT_CARD' ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Cartão de Crédito</span>
                </button>
              </div>

              {paymentMethod === 'PIX' ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2 text-xs">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-block">
                    ✓ Desconto de 5% aplicado no PIX
                  </span>
                  <p className="text-slate-600">Ao clicar abaixo, a assinatura do plano <strong className="text-slate-900 uppercase">{selectedPlan}</strong> será ativada instantaneamente para teste.</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Número do Cartão" defaultValue="4532 •••• •••• 8892" className="col-span-2 px-3 py-1.5 border border-slate-300 rounded text-xs font-medium" />
                    <input type="text" placeholder="MM/AA" defaultValue="08/29" className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium" />
                    <input type="text" placeholder="CVV" defaultValue="782" className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium" />
                  </div>
                </div>
              )}
            </div>

            {/* Step 5 Actions */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                onClick={handleFinishOnboarding}
                disabled={isProcessingPayment}
                className="btn-domu-primary text-xs py-3 px-8 shadow-lg flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Ativando Assinatura...</span>
                  </>
                ) : (
                  <>
                    <span>Ativar Plano {selectedPlan} & Entrar no Portal</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
