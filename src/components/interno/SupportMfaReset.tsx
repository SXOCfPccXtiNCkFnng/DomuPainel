'use client';

import React, { useState } from 'react';
import { Loader2, Search, ShieldOff } from 'lucide-react';

type Lookup = {
  found: boolean;
  user?: { name: string; email: string; company: string | null };
  available?: boolean;
  enabled?: boolean;
  enabledAt?: string | null;
  recoveryCodesLeft?: number;
};

/**
 * Suporte do /interno: desligar a verificação em duas etapas de quem perdeu o
 * celular e os códigos de recuperação. O usuário recebe e-mail avisando.
 */
export default function SupportMfaReset() {
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setConfirming(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/interno/two-factor?email=${encodeURIComponent(email.trim())}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setLookup(null);
        setMsg(json.error || 'Não foi possível buscar.');
        return;
      }
      setLookup(json);
    } catch {
      setMsg('Erro de conexão.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/interno/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lookup?.user?.email }),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg(json.error || 'Não foi possível desligar.');
        return;
      }
      setLookup((l) => (l ? { ...l, enabled: false, enabledAt: null, recoveryCodesLeft: 0 } : l));
      setConfirming(false);
      setMsg('Desligada. O usuário recebeu um e-mail avisando e já entra só com e-mail e senha.');
    } catch {
      setMsg('Erro de conexão.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-black text-slate-900">Suporte · verificação em duas etapas</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Para quem perdeu o celular e os códigos de recuperação. Confirme a identidade da pessoa antes de desligar.
        </p>
      </div>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do usuário"
          className="flex-1 min-w-[220px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          required
        />
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50">
          {busy && !confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Buscar
        </button>
      </form>

      {lookup && !lookup.found && <p className="text-xs text-slate-500">Nenhum usuário com esse e-mail.</p>}

      {lookup?.found && lookup.user && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2 text-xs">
          <p>
            <strong className="text-slate-900">{lookup.user.name}</strong> · {lookup.user.email}
            {lookup.user.company ? ` · ${lookup.user.company}` : ''}
          </p>
          {lookup.enabled ? (
            <>
              <p className="text-slate-600">
                Ligada{lookup.enabledAt ? ` desde ${new Date(lookup.enabledAt).toLocaleDateString('pt-BR')}` : ''} ·{' '}
                {lookup.recoveryCodesLeft} código(s) de recuperação sobrando
              </p>
              {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-red-700 font-bold">Desligar mesmo? A pessoa passa a entrar só com a senha.</span>
                  <button type="button" disabled={busy} onClick={disable} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Sim, desligar
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="font-bold text-slate-500 hover:underline">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-bold hover:bg-red-50 flex items-center gap-1.5">
                  <ShieldOff className="w-3.5 h-3.5" /> Desligar verificação
                </button>
              )}
            </>
          ) : (
            <p className="text-slate-500">Verificação em duas etapas desligada.</p>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </section>
  );
}
