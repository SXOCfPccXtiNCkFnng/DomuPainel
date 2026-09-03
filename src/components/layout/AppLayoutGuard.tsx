'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { isRealEstateSegment, isDispatchOnlySegment, getSegmentFromStorage } from '@/lib/segmentConfig';
import { syncSessionToStorage } from '@/lib/sessionHelpers';
import { getAuthItem, isLoggedIn, setAuthItem, clearAuthSession } from '@/lib/authStorage';

export default function AppLayoutGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/cadastro' ||
    pathname === '/recuperar-senha' ||
    pathname === '/redefinir-senha' ||
    pathname === '/convite';

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // Cadastro/login: não redirecionar para onboarding só porque existe cookie antigo em sync.
      const isPublicAuthEntry =
        pathname === '/login' ||
        pathname === '/cadastro' ||
        pathname === '/recuperar-senha' ||
        pathname === '/redefinir-senha';

      const loggedIn = isLoggedIn();
      let isOnboarded = getAuthItem('domu_is_onboarded') === 'true';

      // Confia no cookie HttpOnly via /api/auth/session (não no tenantId da URL)
      try {
        const res = await fetch('/api/auth/session');
        if (res.status === 401) {
          clearClientAndGoLogin();
          return;
        }
        const data = await res.json();
        if (data.success) {
          if (!loggedIn) {
            setAuthItem('domu_is_logged_in', 'true');
          }
          if (data.isOnboarded) {
            syncSessionToStorage(data);
            isOnboarded = true;
          } else if (!isOnboarded) {
            syncSessionToStorage(data);
            isOnboarded = false;
          } else {
            setAuthItem('domu_selected_segment', data.segment);
            setAuthItem('domu_company_name', data.companyName);
            setAuthItem('domu_tenant_id', data.tenantId);
          }
        } else if (!loggedIn) {
          if (!isPublicAuthEntry && pathname !== '/convite') {
            router.replace('/login');
          } else if (!cancelled) {
            setIsAuthChecked(true);
          }
          return;
        }
      } catch {
        if (!loggedIn) {
          if (!isPublicAuthEntry && pathname !== '/convite') {
            router.replace('/login');
          } else if (!cancelled) {
            setIsAuthChecked(true);
          }
          return;
        }
      }

      if (cancelled) return;

      if (!isOnboarded) {
        // Com sessão válida e onboarding pendente: onboarding (não login/cadastro).
        // Middleware já manda /login+/cadastro com cookie para /.
        if (pathname !== '/onboarding') {
          router.replace('/onboarding');
        } else {
          setIsAuthChecked(true);
        }
        return;
      }

      if (isPublicAuthEntry || pathname === '/onboarding' || pathname === '/convite') {
        router.replace('/');
        return;
      }

      const segment = getSegmentFromStorage();
      if (pathname === '/imoveis' && !isRealEstateSegment(segment)) {
        router.replace('/');
        return;
      }
      if (
        (pathname === '/imoveis' || pathname === '/atendimento') &&
        isDispatchOnlySegment(segment)
      ) {
        router.replace('/');
        return;
      }

      setIsAuthChecked(true);
    }

    function clearClientAndGoLogin() {
      clearAuthSession();
      const stay =
        pathname === '/login' ||
        pathname === '/cadastro' ||
        pathname === '/recuperar-senha' ||
        pathname === '/redefinir-senha' ||
        pathname === '/convite';
      if (!stay) {
        router.replace('/login');
      } else if (!cancelled) {
        setIsAuthChecked(true);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

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

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50 w-full">{children}</div>;
  }

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
