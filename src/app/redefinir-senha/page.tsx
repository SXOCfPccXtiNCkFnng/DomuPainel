'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const inputClass =
  'block w-full px-3 py-3 border border-slate-200 bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar;
  const passwordsMatch = password.length > 0 && password === confirm;
  const requirements = [
    { ok: hasMinLength, label: 'Mínimo 8 caracteres' },
    { ok: hasUppercase, label: 'Uma letra maiúscula' },
    { ok: hasNumber, label: 'Um número' },
    { ok: hasSpecialChar, label: 'Um caractere especial' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!isPasswordValid) {
      setErrorMessage('Atenda a todos os requisitos de senha.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }
    if (!token) {
      setErrorMessage('Link inválido. Solicite uma nova recuperação.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Não foi possível redefinir a senha.');
        return;
      }
      router.push('/login?reset=1');
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Nova senha"
      subtitle="Defina uma senha forte para voltar a acessar o portal."
      footer={
        <Link href="/login" className="font-semibold text-domu-blue hover:underline">
          Voltar ao login
        </Link>
      }
    >
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nova senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
              placeholder="Mín. 8 chars, maiúscula, número e símbolo"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar senha</label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-2 border-t border-slate-100">
          {requirements.map((req) => (
            <div
              key={req.label}
              className={`flex items-center gap-1.5 text-xs ${req.ok ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${req.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {req.label}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isPasswordValid || !passwordsMatch}
          className="w-full btn-domu-primary text-base py-3 justify-center disabled:opacity-50"
        >
          {isLoading ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ResetForm />
    </React.Suspense>
  );
}
