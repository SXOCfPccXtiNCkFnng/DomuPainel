'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { clearAuthSession } from '@/lib/authStorage';
import {
  formatPhoneBR,
  validatePhoneBR,
  validateEmail,
  validateFullName,
  validateCompanyName,
} from '@/lib/validators';
import { LegalDocumentModal, LegalDoc } from '@/components/shared/LegalDocumentModal';

const baseInputClass =
  'block w-full px-3 py-3 border bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none transition-colors';

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    companyName: false,
    whatsapp: false,
    password: false,
    confirmPassword: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModalDoc, setLegalModalDoc] = useState<LegalDoc | null>(null);

  // Field level validations
  const nameVal = validateFullName(name);
  const companyVal = validateCompanyName(companyName);
  const emailVal = validateEmail(email);
  const phoneVal = validatePhoneBR(whatsapp);

  // Password validations
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar;

  const isFormValid =
    nameVal.ok &&
    companyVal.ok &&
    emailVal.ok &&
    phoneVal.ok &&
    isPasswordValid &&
    passwordsMatch &&
    acceptedTerms;

  const handleBlur = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneBR(e.target.value);
    setWhatsapp(formatted);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      name: true,
      email: true,
      companyName: true,
      whatsapp: true,
      password: true,
      confirmPassword: true,
    });
    setErrorMessage('');
    setSuccessMessage('');

    if (!isFormValid) {
      if (!nameVal.ok) setErrorMessage(nameVal.error || 'Nome inválido.');
      else if (!companyVal.ok) setErrorMessage(companyVal.error || 'Empresa inválida.');
      else if (!emailVal.ok) setErrorMessage(emailVal.error || 'E-mail inválido.');
      else if (!phoneVal.ok) setErrorMessage(phoneVal.error || 'WhatsApp inválido.');
      else if (!isPasswordValid) setErrorMessage('Atenda a todos os requisitos de senha.');
      else if (!passwordsMatch) setErrorMessage('As senhas não coincidem.');
      else if (!acceptedTerms) setErrorMessage('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          companyName: companyName.trim(),
          whatsapp: phoneVal.digits,
          acceptedTerms,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Erro ao realizar cadastro.');
        setIsLoading(false);
        return;
      }

      clearAuthSession();
      setSuccessMessage('Conta criada com sucesso! Redirecionando para login...');
      setTimeout(() => router.push('/login?registered=1'), 1500);
    } catch {
      setErrorMessage('Falha na comunicação com o servidor. Tente novamente.');
      setIsLoading(false);
    }
  };

  const requirements = [
    { ok: hasMinLength, label: 'Mínimo 8 caracteres' },
    { ok: hasUppercase, label: 'Uma letra maiúscula' },
    { ok: hasNumber, label: 'Um número' },
    { ok: hasSpecialChar, label: 'Um caractere especial' },
  ];

  const getFieldBorderClass = (isTouched: boolean, isValid: boolean, isFilled: boolean) => {
    if (!isTouched && !isFilled) return 'border-slate-200 focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30';
    if (isTouched && !isValid) return 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-300';
    if (isValid && isFilled) return 'border-emerald-400/80 bg-emerald-50/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300';
    return 'border-slate-200 focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30';
  };

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

      <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
        {/* Nome Completo */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Nome completo</span>
            {touched.name && nameVal.ok && (
              <span className="text-xs text-emerald-600 font-normal flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Válido
              </span>
            )}
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleBlur('name')}
            className={`${baseInputClass} ${getFieldBorderClass(touched.name, nameVal.ok, Boolean(name))}`}
            placeholder="Seu nome e sobrenome"
          />
          {touched.name && !nameVal.ok && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {nameVal.error}
            </p>
          )}
        </div>

        {/* Nome da empresa */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Nome da empresa</span>
            {touched.companyName && companyVal.ok && (
              <span className="text-xs text-emerald-600 font-normal flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Válido
              </span>
            )}
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onBlur={() => handleBlur('companyName')}
            className={`${baseInputClass} ${getFieldBorderClass(touched.companyName, companyVal.ok, Boolean(companyName))}`}
            placeholder="Nome comercial da imobiliária ou negócio"
          />
          {touched.companyName && !companyVal.ok && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {companyVal.error}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>WhatsApp</span>
              {whatsapp && phoneVal.ok && (
                <span className="text-xs text-emerald-600 font-normal flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Válido
                </span>
              )}
            </label>
            <input
              type="text"
              required
              value={whatsapp}
              onChange={handleWhatsappChange}
              onBlur={() => handleBlur('whatsapp')}
              className={`${baseInputClass} ${getFieldBorderClass(touched.whatsapp, phoneVal.ok, Boolean(whatsapp))}`}
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
            {touched.whatsapp && !phoneVal.ok && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {phoneVal.error}
              </p>
            )}
          </div>
        </div>

        {/* Senha */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              className={`${baseInputClass} pr-10 ${getFieldBorderClass(touched.password, isPasswordValid, Boolean(password))}`}
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

        {/* Confirmar senha */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>Confirmar senha</span>
            {confirmPassword && passwordsMatch && (
              <span className="text-xs text-emerald-600 font-normal flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Coincidem
              </span>
            )}
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => handleBlur('confirmPassword')}
            className={`${baseInputClass} ${getFieldBorderClass(touched.confirmPassword, passwordsMatch, Boolean(confirmPassword))}`}
            placeholder="Repita a senha"
          />
          {touched.confirmPassword && confirmPassword && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              As senhas não coincidem.
            </p>
          )}
        </div>

        {/* Password requirements list */}
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

        <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 border-slate-300 text-domu-blue focus:ring-domu-blue rounded"
          />
          <span>
            Li e aceito os{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setLegalModalDoc('terms');
              }}
              className="font-semibold text-domu-blue hover:underline"
            >
              Termos de Uso
            </button>{' '}
            e a{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setLegalModalDoc('privacy');
              }}
              className="font-semibold text-domu-blue hover:underline"
            >
              Política de Privacidade
            </button>{' '}
            da Domu Tech.
          </span>
        </label>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full btn-domu-primary text-base py-3 justify-center disabled:opacity-40 transition-all"
        >
          {isLoading ? 'Criando conta...' : (
            <>
              Criar conta
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <LegalDocumentModal doc={legalModalDoc} onClose={() => setLegalModalDoc(null)} />
    </AuthShell>
  );
}

