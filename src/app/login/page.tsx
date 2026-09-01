'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const inputClass =
  'block w-full px-3 py-2.5 border border-slate-200 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Preencha o e-mail e a senha.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'E-mail ou senha incorretos.');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('domu_is_logged_in', 'true');
      localStorage.setItem('domu_user_email', data.user.email);
      localStorage.setItem('domu_user_name', data.user.name);
      localStorage.setItem('domu_tenant_id', data.user.tenantId);

      const isOnboarded = localStorage.getItem('domu_is_onboarded') === 'true';
      router.push(isOnboarded ? '/' : '/onboarding');
    } catch {
      setErrorMessage('Erro ao conectar ao servidor. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Entrar no portal"
      subtitle="Acesse sua conta para gerenciar disparos e automações"
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

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail</label>
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
            <label className="text-xs font-semibold text-slate-600">Senha</label>
            <a href="#" className="text-[11px] font-medium text-domu-blue hover:underline">
              Esqueceu a senha?
            </a>
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

        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
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
          className="w-full btn-domu-primary text-sm py-2.5 justify-center disabled:opacity-50"
        >
          {isLoading ? 'Entrando...' : (
            <>
              Entrar no portal
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
