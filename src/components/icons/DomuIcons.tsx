import React from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  CarFront,
  HeartPulse,
  Headset,
  Megaphone,
  Pizza,
  Repeat,
  Scale,
  Send,
  Settings,
  ShoppingBag,
  UserRoundSearch,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { NavItemId } from '@/lib/segmentConfig';
import { TenantSegment } from '@/types';

interface IconProps {
  className?: string;
  active?: boolean;
}

function IconWrapper({
  children,
  className = '',
}: IconProps & { children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 18 18"
        fill="none"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {children}
      </svg>
    </span>
  );
}

const stroke = (active: boolean) => (active ? '#1E5AF6' : '#94A3B8');
const fill = (active: boolean) => (active ? '#1E5AF6' : '#CBD5E1');

export function NavIcon({ id, active = false, className }: { id: NavItemId; active?: boolean; className?: string }) {
  const s = stroke(active);
  const f = fill(active);
  const lucideColor = active ? '#1E5AF6' : '#94A3B8';

  if (id === 'disparos') {
    return (
      <span
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className || ''}`}
        aria-hidden
      >
        <Send size={16} color={lucideColor} strokeWidth={1.75} />
      </span>
    );
  }

  if (id === 'followup') {
    return (
      <span
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className || ''}`}
        aria-hidden
      >
        <Repeat size={16} color={lucideColor} strokeWidth={1.75} />
      </span>
    );
  }

  if (id === 'agenda') {
    return (
      <span
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className || ''}`}
        aria-hidden
      >
        <CalendarDays size={16} color={lucideColor} strokeWidth={1.75} />
      </span>
    );
  }

  if (id === 'leads' || id === 'visitas' || id === 'servicos' || id === 'financeiro') {
    const Icon =
      id === 'leads' ? UserRoundSearch : id === 'visitas' ? CalendarCheck : id === 'financeiro' ? Wallet : Wrench;
    return (
      <span
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className || ''}`}
        aria-hidden
      >
        <Icon size={16} color={lucideColor} strokeWidth={1.75} />
      </span>
    );
  }

  if (id === 'atendente') {
    return (
      <span
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className || ''}`}
        aria-hidden
      >
        <Headset size={16} color={lucideColor} strokeWidth={1.75} />
      </span>
    );
  }

  if (id === 'configuracoes') {
    return (
      <span
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 ${className || ''}`}
        aria-hidden
      >
        <Settings size={16} color={lucideColor} strokeWidth={1.75} />
      </span>
    );
  }

  const icons: Partial<Record<NavItemId, React.ReactNode>> = {
    dashboard: (
      <>
        <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1.5" stroke={s} strokeWidth="1.4" />
        <rect x="10" y="1.5" width="6.5" height="6.5" rx="1.5" stroke={s} strokeWidth="1.4" />
        <rect x="1.5" y="10" width="6.5" height="6.5" rx="1.5" stroke={s} strokeWidth="1.4" />
        <rect x="10" y="10" width="6.5" height="6.5" rx="1.5" fill={f} stroke={s} strokeWidth="1.4" />
      </>
    ),
    contatos: (
      <>
        <circle cx="6.5" cy="6" r="2.2" stroke={s} strokeWidth="1.4" />
        <path d="M2.5 14.5C2.5 11.5 4.2 10 6.5 10C8.8 10 10.5 11.5 10.5 14.5" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="12.5" cy="6.5" r="1.8" stroke={s} strokeWidth="1.3" />
        <path d="M11 14.5C11.2 12.4 12.2 11.2 13.8 11C15.2 11.2 16 12.2 16.2 14" stroke={s} strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    metricas: (
      <>
        <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke={s} strokeWidth="1.4" />
        <path d="M5.5 12V8.5M9 12V5.5M12.5 12V9.5" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    templates: (
      <>
        <rect x="3" y="2" width="12" height="14" rx="2" stroke={s} strokeWidth="1.4" />
        <path d="M6 6H12M6 9H12M6 12H9" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
    atendimento: (
      <>
        <path d="M2.5 4.5C2.5 3.67 3.17 3 4 3H14C14.83 3 15.5 3.67 15.5 4.5V10.5C15.5 11.33 14.83 12 14 12H9L5.5 15V12H4C3.17 12 2.5 11.33 2.5 10.5V4.5Z" stroke={s} strokeWidth="1.4" strokeLinejoin="round" fill={active ? '#EFF6FF' : 'none'} />
        <circle cx="6.5" cy="7.5" r="0.75" fill={s} />
        <circle cx="9" cy="7.5" r="0.75" fill={s} />
        <circle cx="11.5" cy="7.5" r="0.75" fill={s} />
      </>
    ),
    imoveis: (
      <>
        <path d="M3 8.5L9 3.5L15 8.5V14.5C15 14.78 14.78 15 14.5 15H3.5C3.22 15 3 14.78 3 14.5V8.5Z" stroke={s} strokeWidth="1.4" strokeLinejoin="round" fill={active ? '#EFF6FF' : 'none'} />
        <rect x="7" y="10" width="4" height="5" rx="0.5" stroke={s} strokeWidth="1.2" />
      </>
    ),
    relatorios: (
      <>
        <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke={s} strokeWidth="1.4" />
        <path d="M5 12V9M8 12V6M11 12V8M14 12V5" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    assinatura: (
      <>
        <rect x="2" y="4.5" width="14" height="9" rx="2" stroke={s} strokeWidth="1.4" fill={active ? '#EFF6FF' : 'none'} />
        <path d="M2 8H16" stroke={s} strokeWidth="1.4" />
        <rect x="4" y="11" width="4" height="1.2" rx="0.3" fill={s} />
      </>
    ),
  };

  return <IconWrapper className={className}>{icons[id]}</IconWrapper>;
}

export function SegmentIcon({ segment, className = '' }: { segment: TenantSegment; className?: string }) {
  const configs: Record<TenantSegment, { bg: string; color: string; Icon: LucideIcon }> = {
    imobiliario: { bg: 'bg-blue-50 border-blue-100', color: '#1E5AF6', Icon: Building2 },
    automotivo: { bg: 'bg-cyan-50 border-cyan-100', color: '#0891B2', Icon: CarFront },
    saude: { bg: 'bg-rose-50 border-rose-100', color: '#E11D48', Icon: HeartPulse },
    marketing_apenas: { bg: 'bg-purple-50 border-purple-100', color: '#7C3AED', Icon: Megaphone },
    ecommerce: { bg: 'bg-emerald-50 border-emerald-100', color: '#059669', Icon: ShoppingBag },
    alimentacao: { bg: 'bg-orange-50 border-orange-100', color: '#EA580C', Icon: Pizza },
    juridico: { bg: 'bg-indigo-50 border-indigo-100', color: '#4F46E5', Icon: Scale },
    geral: { bg: 'bg-slate-50 border-slate-200', color: '#475569', Icon: BriefcaseBusiness },
  };

  const { bg, color, Icon } = configs[segment];

  return (
    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg} ${className}`}>
      <Icon size={20} color={color} strokeWidth={1.75} aria-hidden />
    </div>
  );
}

export function DomuShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`w-3.5 h-3.5 ${className}`}>
      <path d="M8 1.5L13 4V8C13 11 10.5 13.5 8 14.5C5.5 13.5 3 11 3 8V4L8 1.5Z" stroke="#10B981" strokeWidth="1.3" strokeLinejoin="round" fill="#ECFDF5" />
      <path d="M6 8L7.5 9.5L10.5 6.5" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
