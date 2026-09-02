import React from 'react';
import { NavItemId } from '@/lib/segmentConfig';
import { TenantSegment } from '@/types';

interface IconProps {
  className?: string;
  active?: boolean;
}

function IconWrapper({
  children,
  className = '',
  active = false,
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

  const icons: Record<NavItemId, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1.5" stroke={s} strokeWidth="1.4" />
        <rect x="10" y="1.5" width="6.5" height="6.5" rx="1.5" stroke={s} strokeWidth="1.4" />
        <rect x="1.5" y="10" width="6.5" height="6.5" rx="1.5" stroke={s} strokeWidth="1.4" />
        <rect x="10" y="10" width="6.5" height="6.5" rx="1.5" fill={f} stroke={s} strokeWidth="1.4" />
      </>
    ),
    disparos: (
      <>
        <path d="M2.5 15.5L15.5 2.5L9.5 15.5L7.5 9.5L1.5 7.5L15.5 2.5" stroke={s} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill={active ? '#EFF6FF' : 'none'} />
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
    configuracoes: (
      <>
        <circle cx="9" cy="9" r="2.2" stroke={s} strokeWidth="1.4" fill={active ? '#EFF6FF' : 'none'} />
        <path d="M9 1.8V3.4M9 14.6V16.2M1.8 9H3.4M14.6 9H16.2M3.9 3.9L5 5M13 13L14.1 14.1M3.9 14.1L5 13M13 5L14.1 3.9" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
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

  return <IconWrapper active={active} className={className}>{icons[id]}</IconWrapper>;
}

export function SegmentIcon({ segment, className = '' }: { segment: TenantSegment; className?: string }) {
  const configs: Record<TenantSegment, { bg: string; content: React.ReactNode }> = {
    imobiliario: {
      bg: 'bg-blue-50 border-blue-100',
      content: (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <path d="M4 11L12 4L20 11V19C20 19.55 19.55 20 19 20H5C4.45 20 4 19.55 4 19V11Z" stroke="#1E5AF6" strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="9" y="13" width="6" height="7" rx="0.5" stroke="#1E5AF6" strokeWidth="1.5" />
        </svg>
      ),
    },
    ecommerce: {
      bg: 'bg-emerald-50 border-emerald-100',
      content: (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <path d="M6 6H21L19 14H8L6 6Z" stroke="#059669" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="10" cy="18" r="1.5" fill="#059669" />
          <circle cx="17" cy="18" r="1.5" fill="#059669" />
          <path d="M3 3H5.5L6 6" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    saude: {
      bg: 'bg-amber-50 border-amber-100',
      content: (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <rect x="4" y="6" width="16" height="14" rx="2" stroke="#D97706" strokeWidth="1.8" />
          <path d="M12 9V17M8 13H16" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    juridico: {
      bg: 'bg-indigo-50 border-indigo-100',
      content: (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <path d="M12 3V21M6 7H18M8 21H16" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="7" r="2" stroke="#4F46E5" strokeWidth="1.5" />
        </svg>
      ),
    },
    marketing_apenas: {
      bg: 'bg-purple-50 border-purple-100',
      content: (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <path d="M3 11L21 4L14 21L11 13L3 11Z" stroke="#7C3AED" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ),
    },
    geral: {
      bg: 'bg-slate-50 border-slate-200',
      content: (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="#475569" strokeWidth="1.8" />
          <path d="M8 9H16M8 12H14M8 15H12" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
  };

  const cfg = configs[segment];

  return (
    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${cfg.bg} ${className}`}>
      {cfg.content}
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
