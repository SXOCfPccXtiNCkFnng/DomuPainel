'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, PlusCircle, LogOut, Settings, CreditCard, ChevronDown, Menu, LineChart } from 'lucide-react';
import { getPageTitle, getSegmentFromStorage } from '@/lib/segmentConfig';
import CampaignWizardModal from '@/components/disparos/CampaignWizardModal';
import { clearAuthSession, getAuthItem } from '@/lib/authStorage';
import { redirectIfDispatchBlocked } from '@/lib/billingGuard';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}

interface HeaderProps {
  onOpenNewDispatchModal?: () => void;
  onMenuClick?: () => void;
}

export default function Header({ onOpenNewDispatchModal, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pageInfo = getPageTitle(pathname, getSegmentFromStorage());
  
  // State for user & company
  const [userName, setUserName] = useState('Gestor DOMU');
  const [userEmail, setUserEmail] = useState('contato@domutech.digital');
  const [companyName, setCompanyName] = useState('Empresa DOMU');
  const [showInterno, setShowInterno] = useState(false);
  
  // Header Modal State (Global Dispatch Wizard)
  const [isHeaderWizardOpen, setIsHeaderWizardOpen] = useState(false);

  // Dropdown States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Notifications State (real — vem de /api/notifications, por usuário)
  const [notifications, setNotifications] = useState<
    { id: string; title: string; message: string; createdAt: string; type: string; read: boolean }[]
  >([]);
  const [metaConnected, setMetaConnected] = useState<boolean | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setNotifications(json.notifications || []);
    } catch {
      /* silencioso — sino só fica sem dado novo */
    }
  };

  useEffect(() => {
    // Read real user data saved in localStorage
    const savedName = getAuthItem('domu_user_name');
    const savedEmail = getAuthItem('domu_user_email');
    const savedCompany = getAuthItem('domu_company_name');

    if (savedName) setUserName(savedName);
    if (savedEmail) setUserEmail(savedEmail);
    if (savedCompany) setCompanyName(savedCompany);
    setShowInterno(getAuthItem('domu_platform_ops') === 'true');

    fetchNotifications();
    const poll = setInterval(fetchNotifications, 60000);

    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMetaConnected(Boolean(data.metrics?.metaConnected));
      })
      .catch(() => {
        /* mantém metaConnected null (esconde a pill) em caso de falha */
      });

    // Close dropdowns on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(poll);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clearAuthSession();
    router.push('/login');
  };

  const handleQuickDispatchClick = async () => {
    if (await redirectIfDispatchBlocked()) return;
    if (onOpenNewDispatchModal) {
      onOpenNewDispatchModal();
    } else {
      setIsHeaderWizardOpen(true);
    }
  };

  // Get User Initials (e.g. Alan Felipe -> AF)
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'DM';

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 fixed top-0 right-0 left-0 md:left-64 z-30 px-3 sm:px-6 flex items-center justify-between gap-2 font-sans">
        {/* Menu + Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-slate-900 tracking-tight truncate">
              {pageInfo.title}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium truncate hidden sm:block">
              {pageInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Connection Status Pill */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-full px-3 py-1 text-[11px] font-semibold text-slate-700">
            <span className="relative flex h-2 w-2">
              {metaConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${metaConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
              ></span>
            </span>
            <span>
              WhatsApp:{' '}
              {metaConnected === null ? (
                <strong className="text-slate-400 font-bold">…</strong>
              ) : metaConnected ? (
                <strong className="text-emerald-700 font-bold">Online</strong>
              ) : (
                <strong className="text-amber-700 font-bold">Pendente</strong>
              )}
            </span>
          </div>

          {/* Quick Action Button (Global Dispatch Opening) */}
          <button
            onClick={handleQuickDispatchClick}
            className="btn-domu-primary text-xs shadow-sm py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Disparo</span>
            <span className="sm:hidden">Disparo</span>
          </button>

          {/* Notifications Bell & Dropdown */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 relative transition-colors cursor-pointer shrink-0"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-domu-blue border-2 border-white shadow-xs"></span>
              )}
            </button>

            {/* Notification Menu */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold">Notificações</h3>
                  </div>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-[11px] text-slate-400">
                      Nenhuma notificação ainda.
                    </p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 hover:bg-slate-50 transition-colors space-y-1 ${
                          !notif.read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {unreadCount > 0 && (
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      onClick={async () => {
                        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                        await fetch('/api/notifications', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ markAllRead: true }),
                        });
                        setIsNotificationsOpen(false);
                      }}
                      className="text-[11px] font-bold text-domu-blue hover:text-blue-700 cursor-pointer"
                    >
                      Marcar todas como lidas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative pl-2 border-l border-slate-200" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-domu-blue text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                {initials}
              </div>
              
              <div className="hidden md:block leading-tight">
                <p className="text-xs font-bold text-slate-900">{userName}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">{companyName}</p>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* User Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header Info */}
                <div className="p-3.5 bg-slate-950 text-white space-y-1 border-b border-slate-800">
                  <p className="text-xs font-black text-white">{userName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
                  <div className="pt-1 flex items-center gap-1.5">
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold">
                      {companyName}
                    </span>
                  </div>
                </div>

                {/* Menu Links */}
                <div className="p-1.5 space-y-0.5 text-xs text-slate-700">
                  <Link
                    href="/configuracoes"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Configurações do Perfil</span>
                  </Link>

                  <Link
                    href="/assinatura"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-700 transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <span>Minha Assinatura e Plano</span>
                  </Link>

                  {showInterno ? (
                    <Link
                      href="/interno"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-700 transition-colors"
                    >
                      <LineChart className="w-4 h-4 text-slate-500" />
                      <span>Painel interno</span>
                    </Link>
                  ) : null}
                </div>

                {/* Logout Action */}
                <div className="p-1.5 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Global Dispatch Campaign Wizard Modal */}
      <CampaignWizardModal
        isOpen={isHeaderWizardOpen}
        onClose={() => setIsHeaderWizardOpen(false)}
        onStartCampaign={(payload) => {
          setIsHeaderWizardOpen(false);
          if (payload.campaignId) {
            router.push(`/disparos?campaign=${payload.campaignId}`);
          } else {
            router.push('/disparos');
          }
        }}
      />
    </>
  );
}
