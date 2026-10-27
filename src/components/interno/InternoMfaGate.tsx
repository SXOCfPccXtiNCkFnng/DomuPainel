'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { clearAuthSession } from '@/lib/authStorage';

/**
 * O /interno exige verificação em duas etapas. SETUP: a conta ainda não ligou;
 * LOGIN: ligou, mas esta sessão foi aberta só com a senha.
 */
export default function InternoMfaGate({ kind, message }: { kind: 'SETUP' | 'LOGIN'; message: string }) {
  const signInAgain = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* segue para o login mesmo assim */
    }
    clearAuthSession();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-md max-w-md w-full space-y-4">
        <ShieldCheck className="w-10 h-10 text-domu-blue mx-auto" />
        <h2 className="text-lg font-black text-slate-900">Verificação em duas etapas obrigatória</h2>
        <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
        {kind === 'SETUP' ? (
          <Link href="/configuracoes" className="inline-block btn-domu-primary text-xs py-2 px-4 shadow-sm">
            Ativar em Configurações
          </Link>
        ) : (
          <button type="button" onClick={signInAgain} className="btn-domu-primary text-xs py-2 px-4 shadow-sm">
            Sair e entrar com o código
          </button>
        )}
      </div>
    </div>
  );
}
