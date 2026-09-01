'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, User, Building, Phone, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

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

  // Password Requirements Checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const isFormValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar && passwordsMatch && name && email && companyName;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isFormValid) {
      if (!passwordsMatch) {
        setErrorMessage('As senhas não coincidem. Digite a mesma senha nos dois campos.');
        return;
      }
      setErrorMessage('Por favor, atenda a todos os requisitos de segurança da senha e preencha os campos obrigatórios.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          companyName,
          whatsapp
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Erro ao realizar cadastro.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage(data.message || 'Conta criada com sucesso no banco de dados!');
      setIsLoading(false);

      setTimeout(() => {
        router.push('/login');
      }, 1500);

    } catch (err: any) {
      setErrorMessage('Falha na comunicação com o servidor. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-4">
        <div className="flex justify-center mb-2">
          <Image 
            src="/logo-com-nome.png" 
            alt="DOMU Tech Logo" 
            width={160} 
            height={36} 
            className="h-8 w-auto object-contain brightness-0 invert"
          />
        </div>
        
        <div className="space-y-2">
          <p className="text-xs font-black uppercase text-blue-400 tracking-widest">
            Tecnologia que Impulsiona Negócios
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Criar Conta no Portal DOMU Tech
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cadastre sua empresa e obtenha acesso imediato à plataforma de disparos e automações no WhatsApp
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg z-10 px-4">
        <div className="bg-slate-900/90 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800/80 backdrop-blur-md space-y-5">
          
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage} Redirecionando para o login...</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Nome Completo */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome Completo
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  placeholder="Seu Nome Completo"
                />
              </div>
            </div>

            {/* Nome da Empresa */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome Comercial da Empresa / Imobiliária
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Building className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  placeholder="Ex: DOMU Imóveis & Consultoria"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* E-mail */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  E-mail Corporativo
                </label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                    placeholder="seu.email@email.com"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  WhatsApp Comercial
                </label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Senha Segura
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  placeholder="Crie uma senha forte"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmação de Senha */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Confirmar Senha
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-9 pr-3 py-2 border rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none text-xs font-medium ${
                    confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-slate-700/80 focus:ring-2 focus:ring-blue-500'
                  }`}
                  placeholder="Digite a senha novamente"
                />
              </div>
            </div>

            {/* Password Requirements Real-Time Checklist */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
              <p className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Requisitos de Segurança da Senha:</p>
              
              <div className="grid grid-cols-2 gap-1 text-slate-400">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-bold' : ''}`}>
                  <CheckCircle2 className={`w-3 h-3 ${hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400 font-bold' : ''}`}>
                  <CheckCircle2 className={`w-3 h-3 ${hasUppercase ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>1 Letra Maiúscula (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-bold' : ''}`}>
                  <CheckCircle2 className={`w-3 h-3 ${hasNumber ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>1 Número (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecialChar ? 'text-emerald-400 font-bold' : ''}`}>
                  <CheckCircle2 className={`w-3 h-3 ${hasSpecialChar ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>1 Caractere Especial (!@#$)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-domu-blue hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <span>Criando sua conta...</span>
              ) : (
                <>
                  <span>Criar Conta & Salvar no Banco</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
            Já tem uma conta no Portal?{' '}
            <Link href="/login" className="font-extrabold text-blue-400 hover:text-blue-300">
              Fazer Login
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
