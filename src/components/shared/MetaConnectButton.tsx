'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { ExternalLink, RefreshCw } from 'lucide-react';

type FbLoginResponse = { authResponse?: { code?: string } };

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
        params: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras?: Record<string, unknown>;
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const embeddedSignupDataRef = useRef<EmbeddedSignupData>({});
  const stuckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
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

  const handleClick = () => {
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
    setIsConnecting(true);
    embeddedSignupDataRef.current = {};

    clearStuckTimeout();
    // Se a pessoa fechar o popup pelo X, o SDK às vezes nunca chama esse
    // callback — sem esse limite o botão ficaria travado pra sempre.
    stuckTimeoutRef.current = setTimeout(() => {
      setIsConnecting(false);
      setError('Não detectamos resposta da Meta (o popup pode ter sido fechado). Tente novamente.');
    }, 90_000);

    window.FB.login(
      async (response) => {
        clearStuckTimeout();
        const code = response.authResponse?.code;
        if (!code) {
          setError('Conexão cancelada ou não autorizada na Meta.');
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
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
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
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      <button type="button" onClick={handleClick} disabled={isConnecting || !fbSdkReady} className={className}>
        {isConnecting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Conectando...
          </>
        ) : !fbSdkReady ? (
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
    </div>
  );
}
