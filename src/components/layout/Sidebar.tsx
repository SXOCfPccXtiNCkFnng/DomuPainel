'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { TenantSegment } from '@/types';
import {
  SEGMENT_LABELS,
  getPlatformNavForSegment,
  ADMIN_NAV,
  getSegmentFromStorage,
} from '@/lib/segmentConfig';
import { NavIcon, DomuShieldIcon } from '@/components/icons/DomuIcons';
import { getAuthItem } from '@/lib/authStorage';

export default function Sidebar() {
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState('DOMU Empresa');
  const [segment, setSegment] = useState<TenantSegment>('geral');

  useEffect(() => {
    const savedCompany = getAuthItem('domu_company_name');
    if (savedCompany) setCompanyName(savedCompany);
    setSegment(getSegmentFromStorage());
  }, []);

  const platformNav = getPlatformNavForSegment(segment);
  const segmentName = SEGMENT_LABELS[segment] || 'Geral';

  return (
    <aside className="w-64 bg-white text-slate-800 min-h-screen flex flex-col border-r border-slate-200 fixed left-0 top-0 bottom-0 z-40 font-sans">

      <div className="py-4 px-5 border-b border-slate-100 flex items-center justify-center">
        <Link href="/" className="flex items-center justify-center w-full">
          <Image
            src="/logo-com-nome.png"
            alt="Domu Tech Logo"
            width={155}
            height={38}
            priority
            className="h-9 w-auto object-contain mx-auto"
          />
        </Link>
      </div>

      <div className="px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-900 truncate">{companyName && companyName !== 'Domu' ? companyName : 'Minha Empresa'}</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">

        <div className="space-y-0.5">
          <p className="px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
            Plataforma
          </p>
          {platformNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            if (item.isComingSoon) {
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-400 cursor-not-allowed"
                >
                  <div className="flex items-center gap-2.5">
                    <NavIcon id={item.id} active={false} />
                    <span>{item.name}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                    {item.badge}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
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
  );
}
