'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2, Check } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { syncSessionToStorage } from '@/lib/sessionHelpers';
import { persistLoginSession } from '@/lib/authStorage';
import { validateEmail } from '@/lib/validators';

const baseInputClass =
  'block w-full px-3 py-3 border bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none transition-colors';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const emailVal = validateEmail(email);
  const isPasswordProvided = password.trim().length > 0;
  const isFormValid = emailVal.ok && isPasswordProvided;

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccessMessage('Conta criada! Entre com seu e-mail e senha para continuar o onboarding.');
    }
  }, [searchParams]);

  const handleBlur = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setErrorMessage('');
    setSuccessMessage('');

    if (!emailVal.ok) {
      setErrorMessage(emailVal.error || 'Insira um e-mail válido.');
      return;
    }

    if (!isPasswordProvided) {
      setErrorMessage('Informe sua senha de acesso.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          rememberMe,
        }),
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

  const getFieldBorderClass = (isTouched: boolean, isValid: boolean, isFilled: boolean) => {
    if (!isTouched && !isFilled) return 'border-slate-200 focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30';
    if (isTouched && !isValid) return 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-300';
    if (isValid && isFilled) return 'border-emerald-400/80 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300';
    return 'border-slate-200 focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30';
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 rounded-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        {/* E-mail */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>E-mail</span>
            {touched.email && emailVal.ok && (
              <span className="text-xs text-emerald-600 font-normal flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Válido
              </span>
            )}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleBlur('email')}
            className={`${baseInputClass} ${getFieldBorderClass(touched.email, emailVal.ok, Boolean(email))}`}
            placeholder="seu@email.com"
          />
          {touched.email && !emailVal.ok && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {emailVal.error}
            </p>
          )}
        </div>

        {/* Senha */}
        <div>
          <div className="flex items-center justify-between mb-1">
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
              onBlur={() => handleBlur('password')}
              className={`${baseInputClass} pr-10 ${getFieldBorderClass(touched.password, isPasswordProvided, Boolean(password))}`}
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
          {touched.password && !isPasswordProvided && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              A senha é obrigatória.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="border-slate-300 text-domu-blue focus:ring-domu-blue rounded"
          />
          Lembrar meu acesso
        </label>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full btn-domu-primary text-base py-3 justify-center disabled:opacity-40 transition-all"
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
