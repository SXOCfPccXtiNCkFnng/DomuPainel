'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('contato@domutech.digital');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      localStorage.setItem('domu_is_logged_in', 'true');
      setIsLoading(false);
      router.push('/onboarding');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-4">
        {/* Clean Logo without box border */}
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
            Acesse o Portal DOMU Tech
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sua plataforma completa de divulgação, disparos e atendimento no WhatsApp
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800/80 backdrop-blur-md space-y-6">
          
          <form onSubmit={handleLogin} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
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
                  className="block w-full pl-9 pr-3 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs font-medium"
                  placeholder="seuemail@empresa.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Senha
                </label>
                <a href="#" className="text-[11px] font-bold text-blue-400 hover:text-blue-300">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-700/80 rounded-lg bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500" />
                <span>Lembrar meu acesso</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-domu-blue hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <span>Acessando...</span>
              ) : (
                <>
                  <span>Entrar no Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
            Ainda não tem uma conta?{' '}
            <Link href="/onboarding" className="font-extrabold text-blue-400 hover:text-blue-300">
              Criar Conta Grátis
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
