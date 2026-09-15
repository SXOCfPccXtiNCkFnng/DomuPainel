'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Script from 'next/script';
import { ExternalLink, RefreshCw, X } from 'lucide-react';

type FbLoginResponse = { authResponse?: { code?: string; accessToken?: string } };
type FbLoginStatusResponse = {
  status?: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: { code?: string; accessToken?: string };
};

declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      getLoginStatus: (callback: (response: FbLoginStatusResponse) => void) => void;
      login: (
        callback: (response: FbLoginResponse) => void,
        params?: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          extras?: Record<string, unknown> | string;
          scope?: string;
        }
      ) => void;
    };
  }
}

type EmbeddedSignupData = {
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
};

export type MetaConnectResult = {
  wabaId: string;
  phoneNumberId: string;
  whatsappPhone?: string | null;
  verifyToken?: string | null;
  warnings?: string[];
};

type Step = 'login' | 'coexistencia';

/**
 * Botão do Meta WhatsApp Embedded Signup (Coexistência real). Usado no
 * onboarding e em /configuracoes — mesma lógica, evita duplicar o
 * carregamento do SDK e a troca do code pelo token em dois lugares.
 *
 * Fluxo em duas etapas: o passo 1 não chama FB.login (Login for Business
 * recusa public_profile/email e WhatsApp sem config_id abre “criar número”).
 * O passo 2 é o FB.login() com config_id + featureType de coexistência.
 */
export function MetaConnectButton({
  whatsappPhone,
  companyName,
  segment,
  ownerName,
  cityState,
  onConnected,
  label = 'Conectar com Meta',
  className = 'btn-domu-primary text-sm py-3 justify-center disabled:opacity-50',
}: {
  whatsappPhone?: string;
  companyName?: string;
  segment?: string;
  ownerName?: string;
  cityState?: string;
  onConnected: (result: MetaConnectResult) => void;
  label?: string;
  className?: string;
}) {
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<Step>('login');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const embeddedSignupDataRef = useRef<EmbeddedSignupData>({});
  const stuckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<Step>('login');
  const connectingRef = useRef(false);

  const clearStuckTimeout = () => {
    if (stuckTimeoutRef.current) {
      clearTimeout(stuckTimeoutRef.current);
      stuckTimeoutRef.current = null;
    }
  };

  // O SDK da Meta nem sempre chama o callback do FB.login quando a pessoa
  // fecha o popup pelo X (em vez de cancelar pela própria tela da Meta) —
  // sem isso o botão trava em "Conectando..." pra sempre. Esse timeout
  // libera o botão de novo se isso acontecer.
  useEffect(() => clearStuckTimeout, []);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        typeof event.origin !== 'string' ||
        (!event.origin.endsWith('facebook.com') && !event.origin.endsWith('instagram.com'))
      ) {
        return;
      }
      try {
        const raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        const data = JSON.parse(raw);
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;

        // Coexistência usa FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING; o fluxo
        // Cloud API comum usa FINISH / FINISH_ONLY_WABA.
        if (
          data.event === 'FINISH' ||
          data.event === 'FINISH_ONLY_WABA' ||
          data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        ) {
          embeddedSignupDataRef.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
            businessId: data.data?.business_id,
          };
        }
      } catch {
        /* mensagens que não são JSON do embedded signup são ignoradas */
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const openModal = () => {
    setError('');
    setStep('login');
    stepRef.current = 'login';
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    clearStuckTimeout();
    connectingRef.current = false;
    setIsConnecting(false);
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen, closeModal]);

  const goToCoexistencia = () => {
    setError('');
    connectingRef.current = false;
    setIsConnecting(false);
    stepRef.current = 'coexistencia';
    setStep('coexistencia');
  };

  /** Passo 1: não chama FB.login. Este app é Facebook Login for Business —
   * login só com public_profile/email cai em “precisa de uma supported
   * permission”. Pedir WhatsApp sem config_id abre “criar número novo”.
   * A sessão oficial só existe no passo 2, com o config_id de coexistência. */
  const handleFacebookLoginClick = () => {
    if (!window.FB) {
      setError('SDK da Meta ainda não carregou. Aguarde alguns segundos e tente de novo.');
      return;
    }
    goToCoexistencia();
  };

  /** Passo 2: Embedded Signup de coexistência (config_id + featureType). */
  const handleConnectWhatsAppClick = () => {
    if (!window.FB) {
      setError('SDK da Meta ainda não carregou. Aguarde alguns segundos e tente de novo.');
      return;
    }
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
    if (!configId) {
      setError('Conexão com a Meta não configurada (NEXT_PUBLIC_META_CONFIG_ID ausente).');
      return;
    }

    setError('');
    connectingRef.current = true;
    setIsConnecting(true);
    embeddedSignupDataRef.current = {};

    clearStuckTimeout();
    // Se a pessoa fechar o popup pelo X, o SDK às vezes nunca chama esse
    // callback — sem esse limite o botão ficaria travado pra sempre.
    stuckTimeoutRef.current = setTimeout(() => {
      if (!connectingRef.current || stepRef.current !== 'coexistencia') return;
      connectingRef.current = false;
      setIsConnecting(false);
      setError(
        'Não detectamos resposta da Meta. Tente de novo — se persistir, um bloqueador de anúncios pode estar interferindo.'
      );
    }, 90_000);

    // O SDK da Meta valida em runtime que o callback é uma function comum
    // ("Expression is of type asyncfunction, not function") — passar uma
    // arrow function async direto quebra a chamada antes do popup abrir.
    // Por isso o callback síncrono só dispara o handler async, sem esperá-lo.
    // Snippet oficial de coexistência (Onboard WhatsApp Business app users).
    // extras.version v4 no link hospedado pela Meta NÃO muda a tela — o fluxo
    // customizado só aparece se o app estiver habilitado como Tech Provider.
    window.FB.login(
      (response) => {
        void handleFbLoginResponse(response);
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    );
  };

  const handleFbLoginResponse = async (response: FbLoginResponse) => {
    clearStuckTimeout();
    connectingRef.current = false;
    const code = response.authResponse?.code;
    if (!code) {
      setError(
        'Conexão cancelada ou incompleta na Meta. No popup, escolha conectar o WhatsApp Business que já está no celular (coexistência) — não “criar número novo”.'
      );
      setIsConnecting(false);
      return;
    }

    const { wabaId: signupWabaId, phoneNumberId: signupPhoneNumberId } =
      embeddedSignupDataRef.current;
    if (!signupWabaId || !signupPhoneNumberId) {
      setError('Não recebemos o WABA/número da Meta. Tente conectar novamente.');
      setIsConnecting(false);
      return;
    }

    try {
      const res = await fetch('/api/onboarding/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          wabaId: signupWabaId,
          phoneNumberId: signupPhoneNumberId,
          whatsappPhone,
          companyName,
          segment,
          ownerName,
          cityState,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Não foi possível concluir a conexão com a Meta.');
        setIsConnecting(false);
        return;
      }

      setModalOpen(false);
      onConnected({
        wabaId: signupWabaId,
        phoneNumberId: signupPhoneNumberId,
        whatsappPhone: data.whatsappPhone,
        verifyToken: data.verifyToken,
        warnings: data.warnings,
      });
    } catch {
      setError('Erro ao salvar a conexão no servidor. Tente novamente.');
    } finally {
      setIsConnecting(false);
    }
  };

  if (!process.env.NEXT_PUBLIC_META_APP_ID) {
    return (
      <p className="text-xs text-slate-400 italic">
        Conexão com a Meta ainda não configurada pela equipe Domu (NEXT_PUBLIC_META_APP_ID ausente).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.FB?.init({
            appId: process.env.NEXT_PUBLIC_META_APP_ID as string,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v21.0',
          });
          setFbSdkReady(true);
        }}
      />
      <button type="button" onClick={openModal} disabled={!fbSdkReady} className={className}>
        {!fbSdkReady ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando conexão com a Meta...
          </>
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            {label}
          </>
        )}
      </button>

      {mounted &&
        modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="presentation"
          >
            <div
              className="absolute inset-0 bg-slate-950/50"
              onClick={closeModal}
              aria-hidden
            />
            <div
              className="relative z-10 bg-white w-full max-w-md border border-slate-200 shadow-xl rounded-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="meta-connect-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 id="meta-connect-title" className="text-base font-bold text-slate-900">
                  Conectar WhatsApp
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`px-2 py-1 rounded-full ${
                      step === 'login' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    1. Login no Facebook
                  </span>
                  <span className="text-slate-300">→</span>
                  <span
                    className={`px-2 py-1 rounded-full ${
                      step === 'coexistencia' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    2. Conectar WhatsApp
                  </span>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                {step === 'login' ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      No próximo passo a Meta abre o login oficial, já com as permissões do WhatsApp
                      Business. Use a conta do Facebook do seu negócio — não um perfil pessoal, se
                      forem contas diferentes.
                    </p>
                    <button
                      type="button"
                      onClick={handleFacebookLoginClick}
                      disabled={isConnecting}
                      className="btn-domu-primary w-full text-sm py-3 justify-center disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Continuando...
                        </>
                      ) : (
                        'Continuar'
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      No popup da Meta, entre com o Facebook do negócio e escolha{' '}
                      <strong>conectar o WhatsApp Business que já está no celular</strong>{' '}
                      (coexistência). Se aparecer só “criar número novo” ou “número virtual”, feche —
                      isso ainda não é o fluxo de coexistência.
                    </p>
                    <button
                      type="button"
                      onClick={handleConnectWhatsAppClick}
                      disabled={isConnecting}
                      className="btn-domu-primary w-full text-sm py-3 justify-center disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        'Conectar WhatsApp Business'
                      )}
                    </button>
                  </>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Se um bloqueador de anúncios (AdBlock, Brave, Opera, uBlock) estiver ativo para este
                  site, desative-o antes de continuar — ele costuma bloquear o login da Meta.
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
