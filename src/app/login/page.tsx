'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, Building2, ShoppingBag, Stethoscope, Briefcase } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('contato@domutech.digital');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate authentication and redirect to onboarding or dashboard
    setTimeout(() => {
      setIsLoading(false);
      router.push('/onboarding');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-3">
        <div className="flex justify-center">
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-xl inline-flex items-center gap-2">
            <Image 
              src="/logo-com-nome.png" 
              alt="DOMU Tech Logo" 
              width={140} 
              height={32} 
              className="h-7 w-auto object-contain brightness-0 invert"
            />
          </div>
        </div>
        
        <div>
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Plataforma Multi-Segmento SaaS
          </span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Acesse o Portal DOMU Tech
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Gerencie disparos, automações e atendimento inteligente via Meta Cloud API
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

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500" />
                <span>Lembrar meu acesso</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-domu-blue hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
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

          {/* Multi-Segment Showcase Icons */}
          <div className="pt-4 border-t border-slate-800 text-center space-y-2">
            <p className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
              Segmentos Suportados no Portal
            </p>
            <div className="flex items-center justify-center gap-4 text-slate-400 pt-1">
              <div className="flex items-center gap-1 text-[11px] font-semibold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Imobiliário</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                <span>E-commerce</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <Stethoscope className="w-3.5 h-3.5 text-amber-400" />
                <span>Saúde</span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
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
