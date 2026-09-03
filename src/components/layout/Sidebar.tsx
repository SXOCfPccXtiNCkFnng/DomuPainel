'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { TenantSegment } from '@/types';
import {
  getPlatformNavForSegment,
  ADMIN_NAV,
  getSegmentFromStorage,
} from '@/lib/segmentConfig';
import { NavIcon, DomuShieldIcon } from '@/components/icons/DomuIcons';
import { getAuthItem } from '@/lib/authStorage';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState('DOMU Empresa');
  const [segment, setSegment] = useState<TenantSegment>('geral');

  useEffect(() => {
    const savedCompany = getAuthItem('domu_company_name');
    if (savedCompany) setCompanyName(savedCompany);
    setSegment(getSegmentFromStorage());
  }, []);

  // Fecha o drawer ao navegar (mobile)
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const platformNav = getPlatformNavForSegment(segment);

  return (
    <>
      {/* Backdrop mobile */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`w-64 max-w-[85vw] bg-white text-slate-800 min-h-screen flex flex-col border-r border-slate-200 fixed left-0 top-0 bottom-0 z-50 font-sans transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="py-4 px-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center justify-center flex-1" onClick={onClose}>
            <Image
              src="/logo-com-nome.png"
              alt="Domu Tech Logo"
              width={155}
              height={38}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 truncate">
              {companyName && companyName !== 'Domu' ? companyName : 'Minha Empresa'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-5 overflow-y-auto overscroll-contain">
          <div className="space-y-0.5">
            <p className="px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Plataforma
            </p>
            {platformNav.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              if (item.isComingSoon) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-400 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <NavIcon id={item.id} active={false} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      {item.badge}
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-domu-blue font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <NavIcon id={item.id} active={isActive} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-50 text-domu-blue border border-blue-100 shrink-0">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="space-y-0.5">
            <p className="px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
              Administração
            </p>
            {ADMIN_NAV.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-domu-blue font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <NavIcon id={item.id} active={isActive} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <DomuShieldIcon />
              Meta Coexistência
            </span>
            <span className="font-mono text-slate-400">v2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
