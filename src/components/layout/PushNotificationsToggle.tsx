'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BellRing, Download, Loader2, Share } from 'lucide-react';
import {
  canPromptInstall,
  isIos,
  isStandalone,
  onInstallPromptChange,
  promptInstall,
  pushSupported,
  registerServiceWorker,
  urlBase64ToUint8Array,
} from '@/lib/pwaClient';

type Status = 'loading' | 'unsupported' | 'ios-install' | 'not-configured' | 'denied' | 'off' | 'on';

async function saveSubscription(sub: PushSubscription): Promise<string | null> {
  const res = await fetch('/api/push/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  const json = await res.json().catch(() => ({}));
  return json.success ? null : json.error || 'Não foi possível ativar.';
}

/** Ativar/desativar notificações no celular — fica no rodapé do sino. */
export default function PushNotificationsToggle() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [installable, setInstallable] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    setInstallable(canPromptInstall() && !isStandalone());
    const stop = onInstallPromptChange(() => setInstallable(canPromptInstall() && !isStandalone()));

    (async () => {
      if (isIos() && !isStandalone()) return setStatus('ios-install');
      if (!pushSupported()) return setStatus('unsupported');
      try {
        const [reg, keyRes] = await Promise.all([registerServiceWorker(), fetch('/api/push/subscription')]);
        const json = await keyRes.json().catch(() => ({}));
        if (!reg) return setStatus('unsupported');
        if (!json.publicKey) return setStatus('not-configured');
        regRef.current = reg;
        keyRef.current = json.publicKey;
        if (Notification.permission === 'denied') return setStatus('denied');
        const sub = await reg.pushManager.getSubscription();
        // Reenvia ao servidor: o aparelho pode ter trocado de usuário desde a última vez.
        if (sub && Notification.permission === 'granted' && !(await saveSubscription(sub))) return setStatus('on');
        setStatus('off');
      } catch {
        setStatus('unsupported');
      }
    })();
    return () => {
      stop();
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Pedido de permissão precisa vir direto do toque (exigência do iPhone).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = regRef.current;
      if (!reg || !keyRef.current) return;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRef.current),
        }));
      const error = await saveSubscription(sub);
      if (error) {
        setMessage(error);
        return;
      }
      setStatus('on');
      await fetch('/api/push/test', { method: 'POST' });
    } catch {
      setMessage('Não foi possível ativar neste aparelho.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await regRef.current?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      setMessage(json.success ? 'Teste enviado. Deve chegar em alguns segundos.' : json.error || 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return null;

  const install = installable && (
    <button
      type="button"
      onClick={async () => {
        await promptInstall();
      }}
      className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-700 border border-slate-200 rounded-lg py-1.5 hover:bg-white"
    >
      <Download className="w-3.5 h-3.5" /> Instalar o app no aparelho
    </button>
  );

  return (
    <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
      <div className="flex items-center gap-1.5">
        <BellRing className="w-3.5 h-3.5 text-domu-blue" />
        <span className="text-[11px] font-bold text-slate-900">Notificações no celular</span>
        {status === 'on' && (
          <span className="ml-auto text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            Ativas aqui
          </span>
        )}
      </div>

      {status === 'ios-install' && (
        <div className="text-[11px] text-slate-600 leading-relaxed space-y-1">
          <p>No iPhone, as notificações só funcionam com o painel instalado:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>
              No Safari, toque em <Share className="inline w-3 h-3 -mt-0.5" /> <strong>Compartilhar</strong>.
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>Abra o painel pelo ícone novo e ative aqui no sino.</li>
          </ol>
          <p className="text-slate-400">Precisa do iOS 16.4 ou mais novo.</p>
        </div>
      )}

      {status === 'unsupported' && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Este navegador não recebe notificações. No celular, use o Chrome (Android) ou instale o painel na tela
          inicial (iPhone).
        </p>
      )}

      {status === 'not-configured' && (
        <p className="text-[11px] text-slate-500">Notificações no celular ainda não foram liberadas no servidor.</p>
      )}

      {status === 'denied' && (
        <p className="text-[11px] text-amber-700 leading-relaxed">
          As notificações foram bloqueadas neste aparelho. Libere nas configurações do navegador (ícone de cadeado ao
          lado do endereço) ou do celular e abra o sino de novo.
        </p>
      )}

      {status === 'off' && (
        <>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Receba os avisos do painel mesmo com ele fechado: novos agendamentos, cliente pedindo atendimento,
            campanhas concluídas.
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="w-full btn-domu-primary text-[11px] py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Ativar neste aparelho
          </button>
        </>
      )}

      {status === 'on' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={sendTest}
            disabled={busy}
            className="flex-1 text-[11px] font-bold text-domu-blue border border-blue-200 rounded-lg py-1.5 hover:bg-white disabled:opacity-60"
          >
            Enviar teste
          </button>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="flex-1 text-[11px] font-bold text-slate-600 border border-slate-200 rounded-lg py-1.5 hover:bg-white disabled:opacity-60"
          >
            Desativar
          </button>
        </div>
      )}

      {install}
      {message && <p className="text-[11px] text-slate-600">{message}</p>}
    </div>
  );
}
