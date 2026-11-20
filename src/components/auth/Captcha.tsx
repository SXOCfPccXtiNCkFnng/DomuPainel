'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Sem nada depois disso, mostra o aviso com "tentar de novo" (rede lenta de celular incluída). */
const LOAD_TIMEOUT_MS = 15_000;
let loading: Promise<void> | null = null;

function loadScript(force = false) {
  if (force) {
    loading = null;
    document.querySelectorAll(`script[src="${SCRIPT}"]`).forEach((s) => s.remove());
  }
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Navegador embutido do Instagram/Facebook/WhatsApp/TikTok: costuma bloquear o desafio. */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|TikTok|musical_ly|Snapchat/i.test(navigator.userAgent);
}

export const captchaConfigured = Boolean(SITE_KEY);

type Status = 'loading' | 'ready' | 'solved' | 'failed';

/**
 * Desafio anti-robô do Cloudflare (Turnstile). Cada token vale uma vez: o
 * desafio recomeça quando `resetKey` muda (depois de cada envio). Sempre
 * mostra o estado (carregando, ok ou erro com "tentar de novo") — no celular,
 * se o script não carregar, a pessoa precisa saber o que fazer em vez de
 * ficar presa sem nada na tela. Sem a chave configurada, não aparece e o
 * servidor também não cobra.
 */
export default function Captcha({ onToken, resetKey }: { onToken: (token: string) => void; resetKey?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    onTokenRef.current = onToken;
  });
  useEffect(() => setInApp(isInAppBrowser()), []);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let cancelled = false;
    const el = ref.current;
    setStatus('loading');
    const timer = setTimeout(() => {
      if (!cancelled && !widget.current) setStatus('failed');
    }, LOAD_TIMEOUT_MS);

    loadScript(attempt > 0)
      .then(() => {
        if (cancelled || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          language: 'pt-br',
          theme: 'light',
          // Ocupa a largura do formulário (de 300px até o espaço que houver): cabe em celular pequeno.
          size: 'flexible',
          appearance: 'always',
          'refresh-expired': 'auto',
          retry: 'auto',
          callback: (token: string) => {
            setStatus('solved');
            onTokenRef.current(token);
          },
          'expired-callback': () => {
            setStatus('ready');
            onTokenRef.current('');
          },
          'error-callback': () => {
            setStatus('failed');
            onTokenRef.current('');
          },
        });
        setStatus((s) => (s === 'solved' ? s : 'ready'));
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (widget.current && resetKey !== undefined) {
      onTokenRef.current('');
      setStatus('ready');
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey]);

  const retry = useCallback(() => {
    onTokenRef.current('');
    if (widget.current && window.turnstile) {
      setStatus('ready');
      window.turnstile.reset(widget.current);
      return;
    }
    setAttempt((n) => n + 1);
  }, []);

  if (!SITE_KEY) return null;
  return (
    <div className="space-y-1.5">
      {/* Espaço reservado: o widget aparece aqui (nunca fica escondido). */}
      <div ref={ref} className="w-full min-h-[65px] flex justify-center" />
      {status === 'loading' && (
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando a verificação anti-robô...
        </p>
      )}
      {status === 'solved' && (
        <p className="text-[11px] text-emerald-700 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Verificação concluída
        </p>
      )}
      {status === 'failed' && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1.5">
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              A verificação anti-robô não carregou.{' '}
              {inApp
                ? 'Você está no navegador do Instagram/WhatsApp, que bloqueia essa verificação: toque nos três pontinhos e escolha "Abrir no navegador" (Chrome ou Safari).'
                : 'Confira a internet e desligue bloqueador de anúncios ou "modo econômico de dados" para este site.'}
            </span>
          </p>
          <button type="button" onClick={retry} className="font-bold text-domu-blue flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
