'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { syncSessionToStorage } from '@/lib/sessionHelpers';
import { persistLoginSession } from '@/lib/authStorage';

const inputClass =
  'block w-full px-3 py-3 border border-slate-200 bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccessMessage('Conta criada! Entre com seu e-mail e senha para continuar o onboarding.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Preencha o e-mail e a senha.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'E-mail ou senha incorretos.');
        setIsLoading(false);
        return;
      }

      persistLoginSession(
        {
          domu_is_logged_in: 'true',
          domu_user_email: data.user.email,
          domu_user_name: data.user.name,
          domu_tenant_id: data.user.tenantId,
          domu_is_onboarded: data.user.isOnboarded ? 'true' : 'false',
          domu_selected_segment: data.user.segment,
          domu_company_name: data.user.companyName,
        },
        rememberMe
      );

      syncSessionToStorage({
        isOnboarded: Boolean(data.user.isOnboarded),
        segment: data.user.segment,
        companyName: data.user.companyName,
        tenantId: data.user.tenantId,
      });

      router.push(data.user.isOnboarded ? '/' : '/onboarding');
    } catch {
      setErrorMessage('Erro ao conectar ao servidor. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta e continue automatizando o WhatsApp da sua empresa."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="font-semibold text-domu-blue hover:underline">
            Criar conta grátis
          </Link>
        </>
      }
    >
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-slate-700">Senha</label>
            <Link href="/recuperar-senha" className="text-xs font-medium text-domu-blue hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
              placeholder="Sua senha"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="border-slate-300 text-domu-blue focus:ring-domu-blue"
          />
          Lembrar meu acesso
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-domu-primary text-base py-3 justify-center disabled:opacity-50"
        >
          {isLoading ? 'Entrando...' : (
            <>
              Acessar portal
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-domu-blue/20 border-t-domu-blue rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
