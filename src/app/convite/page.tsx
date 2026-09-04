'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { persistLoginSession } from '@/lib/authStorage';
import { syncSessionToStorage } from '@/lib/sessionHelpers';

const inputClass =
  'block w-full px-3 py-3 border border-slate-200 bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

function ConviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [invite, setInvite] = useState<{
    name: string;
    email: string;
    role: string;
    companyName: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(true);
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

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setErrorMessage('Link de convite inválido.');
        setLoadingInvite(false);
        return;
      }
      try {
        const res = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!data.success) {
          setErrorMessage(data.error || 'Convite inválido.');
        } else {
          setInvite(data.invite);
        }
      } catch {
        setErrorMessage('Erro ao validar convite.');
      } finally {
        setLoadingInvite(false);
      }
    };
    load();
  }, [token]);

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
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Não foi possível aceitar o convite.');
        return;
      }

      persistLoginSession(
        {
          domu_is_logged_in: 'true',
          domu_user_email: data.user.email,
          domu_user_name: data.user.name,
          domu_tenant_id: data.user.tenantId,
          domu_is_onboarded: 'true',
          domu_selected_segment: data.user.segment,
          domu_company_name: data.user.companyName,
        },
        true
      );
      syncSessionToStorage({
        isOnboarded: true,
        segment: data.user.segment,
        companyName: data.user.companyName,
        tenantId: data.user.tenantId,
      });
      router.push('/');
    } catch {
      setErrorMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Aceitar convite"
      subtitle={
        invite
          ? `${invite.companyName} convidou você como ${invite.role}.`
          : 'Defina sua senha para entrar no portal.'
      }
      footer={
        <Link href="/login" className="font-semibold text-domu-blue hover:underline">
          Já tenho conta
        </Link>
      }
    >
      {loadingInvite ? (
        <p className="text-sm text-slate-500">Validando convite…</p>
      ) : errorMessage && !invite ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
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
            <input type="email" value={invite?.email || ''} disabled className={`${inputClass} bg-slate-50`} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
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
            {isLoading ? 'Criando acesso…' : 'Entrar no portal'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ConvitePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ConviteForm />
    </React.Suspense>
  );
}
