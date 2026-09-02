'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const inputClass =
  'block w-full px-3 py-3 border border-slate-200 bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Não foi possível enviar o e-mail.');
        return;
      }
      setDone(true);
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Informe o e-mail da sua conta. Se existir, enviaremos um link seguro."
      footer={
        <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-domu-blue hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao login
        </Link>
      }
    >
      {done ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>
              Se o e-mail estiver cadastrado, o link de redefinição foi enviado. Confira também a
              caixa de spam. Em desenvolvimento sem Resend, o link aparece no log do servidor.
            </p>
          </div>
          <Link href="/login" className="btn-domu-primary w-full justify-center py-3">
            Ir para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="seu@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-domu-primary text-base py-3 justify-center disabled:opacity-50"
          >
            {isLoading ? 'Enviando…' : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
