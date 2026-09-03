'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const HIGHLIGHTS = [
  {
    title: 'Disparos em massa',
    desc: 'Campanhas via Meta Cloud API com controle total de entrega.',
  },
  {
    title: 'Automação inteligente',
    desc: 'Templates aprovados, coexistência oficial e zero bloqueio.',
  },
  {
    title: 'CRM integrado',
    desc: 'Leads, histórico e atendimento organizados em um só painel.',
  },
];

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex font-sans">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[44%] bg-[#0B132B] text-white flex-col justify-between p-12 xl:p-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(#1E5AF6 1px, transparent 1px), linear-gradient(90deg, #1E5AF6 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="absolute top-0 right-0 w-72 h-72 bg-domu-blue/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Image
            src="/logo-com-nome.png"
            alt="Domu Tech"
            width={200}
            height={46}
            className="h-10 xl:h-11 w-auto object-contain brightness-0 invert"
            priority
          />
        </div>

        <div className="relative z-10 space-y-8 max-w-md">
          <div className="space-y-4">
            <h1 className="text-3xl xl:text-[2rem] font-bold leading-tight tracking-tight">
              Tecnologia que{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200">
                impulsiona resultados
              </span>{' '}
              no WhatsApp.
            </h1>
            <p className="text-base text-slate-300 leading-relaxed">
              Dispare campanhas, automatize atendimentos e escale seu negócio com a plataforma oficial da Meta — pensada para gerar valor real e acelerar o crescimento da sua empresa.
            </p>
          </div>

          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="w-1 shrink-0 bg-domu-blue mt-1.5 h-8" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-slate-400 mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Domu Tech ·{' '}
          <Link href="https://domutech.digital" target="_blank" className="hover:text-slate-400 transition-colors">
            domutech.digital
          </Link>
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col justify-center bg-[#F8FAFC] px-6 py-10 sm:px-12 xl:px-16">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden mb-10">
            <Image
              src="/logo-com-nome.png"
              alt="Domu Tech"
              width={180}
              height={42}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
            <p className="text-base text-slate-500 mt-2 leading-relaxed">{subtitle}</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 sm:p-7 shadow-sm">
            {children}
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}
