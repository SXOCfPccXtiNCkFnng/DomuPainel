'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Download, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

type Status =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'off' }
  | { kind: 'enrolling'; qr: string; secret: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'on'; since: string | null; left: number };

const inputClass =
  'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30';

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/auth/mfa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Verificação em duas etapas da própria conta: depois da senha, o login pede
 * o código de 6 dígitos do aplicativo autenticador do celular.
 */
export default function TwoFactorSettings() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [panel, setPanel] = useState<'none' | 'disable' | 'regenerate'>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa');
      const json = await res.json();
      if (!json.success) return setStatus({ kind: 'unavailable', message: json.error || 'Não foi possível carregar.' });
      if (!json.available) {
        return setStatus({ kind: 'unavailable', message: 'A verificação em duas etapas ainda não foi ativada no sistema.' });
      }
      setStatus(json.enabled ? { kind: 'on', since: json.enabledAt, left: json.recoveryCodesLeft } : { kind: 'off' });
    } catch {
      setStatus({ kind: 'unavailable', message: 'Não foi possível carregar.' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (body: Record<string, unknown>, onOk: (json: Record<string, unknown>) => void) => {
    setBusy(true);
    setError(null);
    try {
      const json = await post(body);
      if (!json.success) {
        setError(json.error || 'Não foi possível concluir.');
        setCode('');
        return;
      }
      setCode('');
      setPassword('');
      setPanel('none');
      onOk(json);
    } catch {
      setError('Erro de conexão. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const codesText = status.kind === 'codes' ? status.codes.join('\n') : '';
  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* navegador sem permissão de copiar: o usuário seleciona à mão */
    }
  };
  const downloadCodes = () => {
    const blob = new Blob(
      [`Códigos de recuperação · Domu Tech\nCada código vale uma vez. Guarde num lugar seguro.\n\n${codesText}\n`],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domu-codigos-de-recuperacao.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const codeInput = (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="Código de 6 dígitos"
      className={`${inputClass} font-mono tracking-[0.3em] text-center max-w-[220px]`}
      aria-label="Código do aplicativo autenticador"
    />
  );

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-domu-blue shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-black text-slate-900">Verificação em duas etapas</h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Depois da senha, o login pede um código de 6 dígitos do aplicativo autenticador do seu celular (Google
            Authenticator, Microsoft Authenticator ou similar). Mesmo que alguém descubra sua senha, não entra.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        {status.kind === 'loading' && (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </p>
        )}

        {status.kind === 'unavailable' && <p className="text-xs text-slate-500">{status.message}</p>}

        {status.kind === 'off' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: 'start' }, (json) => setStatus({ kind: 'enrolling', qr: String(json.qr), secret: String(json.secret) }))}
            className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Ativar verificação em duas etapas
          </button>
        )}

        {status.kind === 'enrolling' && (
          <div className="space-y-4">
            <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
              <li>Instale um aplicativo autenticador no celular, se ainda não tiver.</li>
              <li>No aplicativo, toque em adicionar conta e escaneie o QR code abaixo.</li>
              <li>Digite o código de 6 dígitos que aparecer para confirmar.</li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor (data URL) */}
              <img src={status.qr} alt="QR code para o aplicativo autenticador" width={180} height={180} className="rounded-xl border border-slate-200" />
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-bold text-slate-600">Não consegue escanear? Digite esta chave no aplicativo:</p>
                  <p className="font-mono text-sm text-slate-900 break-all mt-1 select-all">{status.secret}</p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run({ action: 'confirm', code }, (json) => setStatus({ kind: 'codes', codes: json.recoveryCodes as string[] }));
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  {codeInput}
                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar e ativar
                  </button>
                  <button type="button" onClick={() => load()} className="text-xs font-bold text-slate-500 hover:underline">
                    Cancelar
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {status.kind === 'codes' && (
          <div className="space-y-3">
            <p className="text-xs text-emerald-700 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4" /> Ativada. Guarde agora os seus códigos de recuperação.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Se perder o celular, cada código abaixo entra uma vez no lugar do aplicativo. Eles não aparecem de novo:
              baixe ou copie e guarde num lugar seguro (fora do celular).
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl p-4">
              {status.codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadCodes} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Baixar
              </button>
              <button type="button" onClick={copyCodes} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
                <Copy className="w-4 h-4" /> {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button type="button" onClick={() => load()} className="btn-domu-primary text-xs py-2 px-4">
                Já guardei
              </button>
            </div>
          </div>
        )}

        {status.kind === 'on' && (
          <div className="space-y-4">
            <p className="text-xs text-emerald-700 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4" /> Ligada
              {status.since ? ` desde ${new Date(status.since).toLocaleDateString('pt-BR')}` : ''}
            </p>
            <p className={`text-xs ${status.left <= 2 ? 'text-amber-700' : 'text-slate-500'}`}>
              {status.left} código(s) de recuperação sobrando.
              {status.left <= 2 ? ' Gere novos para não ficar sem acesso se perder o celular.' : ''}
            </p>

            {panel === 'none' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setPanel('regenerate'); setError(null); }} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  Gerar novos códigos de recuperação
                </button>
                <button type="button" onClick={() => { setPanel('disable'); setError(null); }} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                  <ShieldOff className="w-4 h-4" /> Desligar
                </button>
              </div>
            )}

            {panel === 'regenerate' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run({ action: 'regenerate', code }, (json) => setStatus({ kind: 'codes', codes: json.recoveryCodes as string[] }));
                }}
                className="space-y-2"
              >
                <p className="text-xs text-slate-600">Os códigos antigos deixam de valer. Confirme com o código do aplicativo:</p>
                <div className="flex flex-wrap items-center gap-2">
                  {codeInput}
                  <button type="submit" disabled={busy || code.length !== 6} className="btn-domu-primary text-xs py-2.5 px-5 disabled:opacity-50">
                    Gerar
                  </button>
                  <button type="button" onClick={() => setPanel('none')} className="text-xs font-bold text-slate-500 hover:underline">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {panel === 'disable' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run({ action: 'disable', password, code }, () => setStatus({ kind: 'off' }));
                }}
                className="space-y-2 max-w-sm"
              >
                <p className="text-xs text-slate-600">Para desligar, confirme sua senha e o código do aplicativo:</p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  className={inputClass}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {codeInput}
                  <button type="submit" disabled={busy || !password || code.length !== 6} className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
                    Desligar
                  </button>
                  <button type="button" onClick={() => setPanel('none')} className="text-xs font-bold text-slate-500 hover:underline">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
