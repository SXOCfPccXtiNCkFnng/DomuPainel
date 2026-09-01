'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Send, 
  MessageSquare,
  Building2, 
  FileCode, 
  BarChart3, 
  Settings, 
  ShieldCheck,
  CreditCard
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState('DOMU Empresa');
  const [segmentName, setSegmentName] = useState('Geral');

  useEffect(() => {
    const savedCompany = localStorage.getItem('domu_company_name');
    const savedSegment = localStorage.getItem('domu_selected_segment');
    
    if (savedCompany) setCompanyName(savedCompany);
    if (savedSegment) {
      const segmentLabels: Record<string, string> = {
        imobiliario: 'Imobiliário',
        ecommerce: 'E-commerce',
        saude: 'Saúde',
        marketing_apenas: 'Marketing',
        geral: 'Geral'
      };
      setSegmentName(segmentLabels[savedSegment] || 'Geral');
    }
  }, []);

  const platformNav = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, isComingSoon: false },
    { name: 'Disparos em Massa', href: '/disparos', icon: Send, isComingSoon: false },
    { name: 'Templates de Mensagens', href: '/templates', icon: FileCode, isComingSoon: false },
    { name: 'CRM & Atendimentos', href: '/atendimento', icon: MessageSquare, badge: 'Em Breve', isComingSoon: true },
    { name: 'Imóveis & Leads', href: '/imoveis', icon: Building2, badge: 'Em Breve', isComingSoon: true }
  ];

  const adminNav = [
    { name: 'Relatórios de Análise', href: '/relatorios', icon: BarChart3, badge: 'Em Breve', isComingSoon: true },
    { name: 'Configurações', href: '/configuracoes', icon: Settings, isComingSoon: false },
    { name: 'Assinatura & Planos', href: '/assinatura', icon: CreditCard, isComingSoon: false }
  ];

  return (
    <aside className="w-64 bg-white text-slate-800 min-h-screen flex flex-col border-r border-slate-200 fixed left-0 top-0 bottom-0 z-40 font-sans">
      
      {/* Official DOMU Tech Brand Header */}
      <div className="py-3.5 px-4 border-b border-slate-100 flex items-center justify-center">
        <Link href="/" className="block">
          <Image 
            src="/logo-com-nome.png" 
            alt="DOMU TECH Logo" 
            width={115}
            height={26}
            priority
            className="h-6.5 w-auto object-contain mx-auto"
          />
        </Link>
      </div>

      {/* Active Workspace Info (Dynamic Company Name) */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-1.5 text-slate-900 font-bold truncate max-w-[130px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span className="truncate">{companyName}</span>
        </span>
        <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-domu-blue border border-blue-100 shrink-0">
          {segmentName}
        </span>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto">
        
        {/* Platform Section */}
        <div className="space-y-0.5">
          <p className="px-2.5 text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
            PLATAFORMA
          </p>
          {platformNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            if (item.isComingSoon) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-semibold text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-75"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.name}</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded-sm text-[8.5px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                    {item.badge}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-domu-blue border border-blue-200/60 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-domu-blue' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Administration Section */}
        <div className="space-y-0.5">
          <p className="px-2.5 text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
            ADMINISTRAÇÃO
          </p>
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.isComingSoon) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-semibold text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-75"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.name}</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded-sm text-[8.5px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                    {item.badge}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-domu-blue border border-blue-200/60 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-domu-blue' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>

      </nav>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span className="flex items-center gap-1 text-emerald-600 font-bold">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Meta Coexistência
          </span>
          <span className="font-mono text-slate-400">v2.0</span>
        </div>
      </div>

    </aside>
  );
}
