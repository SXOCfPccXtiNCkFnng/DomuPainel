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

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex font-sans">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-[#0B132B] text-white flex-col justify-between p-12 relative overflow-hidden">
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

        <div className="relative z-10">
          <Image
            src="/logo-com-nome.png"
            alt="DOMU Tech"
            width={140}
            height={32}
            className="h-7 w-auto object-contain brightness-0 invert"
            priority
          />
        </div>

        <div className="relative z-10 space-y-6 max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">
            Portal DOMU Tech
          </p>
          <h1 className="text-2xl font-bold leading-snug">
            Automação de mensagens e atendimento no WhatsApp para qualquer segmento.
          </h1>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 bg-domu-blue mt-2 shrink-0" />
              Disparos em massa via Meta Cloud API
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 bg-domu-blue mt-2 shrink-0" />
              Templates aprovados e coexistência oficial
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 bg-domu-blue mt-2 shrink-0" />
              Multi-segmento: imobiliário, e-commerce, saúde e mais
            </li>
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-slate-500">
          © {new Date().getFullYear()} DOMU Tech · domutech.digital
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col justify-center bg-[#F8FAFC] px-6 py-10 sm:px-12">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden mb-8">
            <Image
              src="/logo-com-nome.png"
              alt="DOMU Tech"
              width={130}
              height={30}
              className="h-7 w-auto object-contain"
              priority
            />
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>

          <div className="bg-white border border-slate-200 p-6 shadow-sm">
            {children}
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}
