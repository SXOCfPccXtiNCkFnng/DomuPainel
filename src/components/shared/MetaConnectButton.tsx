'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { ExternalLink, RefreshCw, X } from 'lucide-react';

type FbLoginResponse = { authResponse?: { code?: string; accessToken?: string } };

declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FbLoginResponse) => void,
        params?: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          extras?: Record<string, unknown>;
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

/**
 * Botão do Meta WhatsApp Embedded Signup (Coexistência real). Usado no
 * onboarding e em /configuracoes — mesma lógica, evita duplicar o
 * carregamento do SDK e a troca do code pelo token em dois lugares.
 *
 * Um único FB.login() com config_id + featureType de coexistência. Um login
 * prévio pedindo whatsapp_business_management (sem config_id) abre o seletor
 * de “criar número novo” da Cloud API, que não é o fluxo de coexistência.
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
  const [modalOpen, setModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const embeddedSignupDataRef = useRef<EmbeddedSignupData>({});
  const stuckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setModalOpen(true);
  };

  const closeModal = () => {
    clearStuckTimeout();
    connectingRef.current = false;
    setIsConnecting(false);
    setModalOpen(false);
  };

  /** Embedded Signup de coexistência: config_id + featureType. Sem config_id a Meta
   * abre o seletor de número novo da Cloud API, que não é coexistência. */
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
      if (!connectingRef.current) return;
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
    window.FB.login(
      (response) => {
        void handleFbLoginResponse(response);
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        // featureType avisa a Meta que é um fluxo de Coexistência — sem ele o
        // número é tratado como um cadastro comum, que exige o número "livre"
        // (sem WhatsApp ativo nele), e cai no erro de "já está registrado".
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <div className="bg-white w-full max-w-md border border-slate-200 shadow-xl rounded-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Conectar WhatsApp</h3>
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
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <p className="text-sm text-slate-600 leading-relaxed">
                No popup da Meta, escolha{' '}
                <strong>conectar o WhatsApp Business que já está no celular</strong> (coexistência).
                Se aparecer só “criar número novo” ou “adicione seu número de telefone”, feche e avise
                a equipe — isso ainda não é o fluxo de coexistência.
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

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Se um bloqueador de anúncios (AdBlock, Brave, Opera, uBlock) estiver ativo para este
                site, desative-o antes de continuar — ele costuma bloquear o login da Meta.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
