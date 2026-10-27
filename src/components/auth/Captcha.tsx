'use client';

import { useEffect, useRef } from 'react';

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
let loading: Promise<void> | null = null;

function loadScript() {
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

export const captchaConfigured = Boolean(SITE_KEY);

/**
 * Desafio anti-robô do Cloudflare (Turnstile). Na maioria das vezes é
 * invisível. Cada token vale uma vez: o desafio recomeça quando `resetKey`
 * muda (depois de cada envio). Sem a chave configurada, não aparece e o
 * servidor também não cobra.
 */
export default function Captcha({ onToken, resetKey }: { onToken: (token: string) => void; resetKey?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let cancelled = false;
    const el = ref.current;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          language: 'pt-br',
          theme: 'auto',
          // Visível quando houver desafio, para nunca travar sem nada para tocar.
          'refresh-expired': 'auto',
          retry: 'auto',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (widget.current && resetKey !== undefined) {
      onTokenRef.current('');
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center empty:hidden" />;
}
