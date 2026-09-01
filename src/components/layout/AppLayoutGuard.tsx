'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function AppLayoutGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/onboarding' || pathname === '/cadastro';

  useEffect(() => {
    // Read state from localStorage
    const isLoggedIn = localStorage.getItem('domu_is_logged_in') === 'true';
    const isOnboarded = localStorage.getItem('domu_is_onboarded') === 'true';

    if (!isLoggedIn) {
      if (pathname !== '/login' && pathname !== '/cadastro') {
        router.push('/login');
      } else {
        setIsAuthChecked(true);
      }
      return;
    }

    if (isLoggedIn && !isOnboarded) {
      if (pathname !== '/onboarding') {
        router.push('/onboarding');
      } else {
        setIsAuthChecked(true);
      }
      return;
    }

    if (isLoggedIn && isOnboarded) {
      if (pathname === '/login' || pathname === '/onboarding' || pathname === '/cadastro') {
        router.push('/');
      } else {
        setIsAuthChecked(true);
      }
      return;
    }

    setIsAuthChecked(true);
  }, [pathname, router]);

  // If Auth check is in progress, show a sleek DOMU loading screen
  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
          Carregando Portal DOMU...
        </span>
      </div>
    );
  }

  // Auth pages (/login and /onboarding) render without Sidebar & Header
  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50 w-full">{children}</div>;
  }

  // Dashboard & Protected Portal Pages render with Sidebar and Header
  return (
    <div className="min-h-screen flex w-full">
      <Sidebar />
      <div className="flex-1 pl-64 flex flex-col min-h-screen w-full">
        <Header />
        <main className="flex-1 pt-24 px-8 pb-12 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
