'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const inputClass =
  'block w-full px-3 py-3 border border-slate-200 bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid =
    hasMinLength && hasUppercase && hasNumber && hasSpecialChar && passwordsMatch && name && email && companyName;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isFormValid) {
      setErrorMessage(
        passwordsMatch
          ? 'Atenda todos os requisitos de senha e preencha os campos obrigatórios.'
          : 'As senhas não coincidem.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, companyName, whatsapp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Erro ao realizar cadastro.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('Conta criada com sucesso!');
      setTimeout(() => router.push('/login'), 1500);
    } catch {
      setErrorMessage('Falha na comunicação com o servidor.');
      setIsLoading(false);
    }
  };

  const requirements = [
    { ok: hasMinLength, label: 'Mínimo 8 caracteres' },
    { ok: hasUppercase, label: 'Uma letra maiúscula' },
    { ok: hasNumber, label: 'Um número' },
    { ok: hasSpecialChar, label: 'Um caractere especial' },
  ];

  return (
    <AuthShell
      title="Comece agora"
      subtitle="Crie sua conta e ative seu portal de automação no WhatsApp em poucos minutos."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold text-domu-blue hover:underline">
            Fazer login
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
          {successMessage} Redirecionando...
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-3.5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome completo</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome da empresa</label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputClass}
            placeholder="Nome comercial"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp</label>
            <input
              type="text"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className={inputClass}
              placeholder="(11) 99999-9999"
            />
          </div>
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
              placeholder="Crie uma senha forte"
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

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar senha</label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`${inputClass} ${confirmPassword && !passwordsMatch ? 'border-red-400' : ''}`}
            placeholder="Repita a senha"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-2 border-t border-slate-100">
          {requirements.map((req) => (
            <div
              key={req.label}
              className={`flex items-center gap-1.5 text-xs ${req.ok ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              <span className={`w-1 h-1 shrink-0 ${req.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {req.label}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full btn-domu-primary text-base py-3 justify-center disabled:opacity-40"
        >
          {isLoading ? 'Criando conta...' : (
            <>
              Criar conta
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
