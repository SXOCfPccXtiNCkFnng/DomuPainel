import { TenantSegment } from '@/types';

export const SEGMENT_LABELS: Record<TenantSegment, string> = {
  imobiliario: 'Imobiliário',
  ecommerce: 'E-commerce',
  saude: 'Saúde',
  juridico: 'Jurídico',
  marketing_apenas: 'Marketing',
  geral: 'Geral',
};

export const SEGMENT_WELCOME: Record<TenantSegment, string> = {
  imobiliario: 'Automatize lançamentos, leads e visitas pelo WhatsApp.',
  ecommerce: 'Recupere carrinhos, envie ofertas e notifique seus clientes.',
  saude: 'Confirme consultas e reduza faltas com mensagens automáticas.',
  juridico: 'Gerencie prazos, cobranças e comunicação com clientes.',
  marketing_apenas: 'Foque em campanhas e disparos em massa no WhatsApp.',
  geral: 'Automatize comunicação e engajamento com seus clientes.',
};

export function isRealEstateSegment(segment: TenantSegment | string | null): boolean {
  return segment === 'imobiliario';
}

export function getSegmentFromStorage(): TenantSegment {
  if (typeof window === 'undefined') return 'geral';
  const saved = localStorage.getItem('domu_selected_segment') as TenantSegment | null;
  return saved && saved in SEGMENT_LABELS ? saved : 'geral';
}

export type NavItemId =
  | 'dashboard'
  | 'disparos'
  | 'templates'
  | 'atendimento'
  | 'imoveis'
  | 'relatorios'
  | 'configuracoes'
  | 'assinatura';

export interface NavItemConfig {
  id: NavItemId;
  name: string;
  href: string;
  badge?: string;
  isComingSoon: boolean;
  segments?: TenantSegment[];
}

export const PLATFORM_NAV: NavItemConfig[] = [
  { id: 'dashboard', name: 'Dashboard', href: '/', isComingSoon: false },
  { id: 'disparos', name: 'Disparos em Massa', href: '/disparos', isComingSoon: false },
  { id: 'templates', name: 'Templates de Mensagens', href: '/templates', isComingSoon: false },
  {
    id: 'atendimento',
    name: 'CRM e Atendimentos',
    href: '/atendimento',
    badge: 'Em Breve',
    isComingSoon: true,
  },
  {
    id: 'imoveis',
    name: 'Imóveis e Leads',
    href: '/imoveis',
    badge: 'Em Breve',
    isComingSoon: true,
    segments: ['imobiliario'],
  },
];

export const ADMIN_NAV: NavItemConfig[] = [
  { id: 'relatorios', name: 'Relatórios de Análise', href: '/relatorios', isComingSoon: false },
  { id: 'configuracoes', name: 'Configurações', href: '/configuracoes', isComingSoon: false },
  { id: 'assinatura', name: 'Assinatura e Planos', href: '/assinatura', isComingSoon: false },
];

export function getPlatformNavForSegment(segment: TenantSegment): NavItemConfig[] {
  return PLATFORM_NAV.filter(
    (item) => !item.segments || item.segments.includes(segment)
  );
}

export const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard de Análise e Performance',
    subtitle: 'Métricas unificadas de disparos e automações no WhatsApp',
  },
  '/disparos': {
    title: 'Disparos em Massa',
    subtitle: 'Crie e gerencie campanhas de mensagens via Meta Cloud API',
  },
  '/templates': {
    title: 'Templates de Mensagens',
    subtitle: 'Gerencie modelos aprovados pela Meta para seus disparos',
  },
  '/atendimento': {
    title: 'CRM e Atendimentos',
    subtitle: 'Central de atendimento multioperadores no WhatsApp',
  },
  '/imoveis': {
    title: 'Imóveis e Leads',
    subtitle: 'Catálogo de lançamentos e automação de alertas',
  },
  '/relatorios': {
    title: 'Relatórios de Análise e Performance',
    subtitle: 'Métricas detalhadas de campanhas e entregas',
  },
  '/configuracoes': {
    title: 'Configurações',
    subtitle: 'API oficial, coexistência e integrações do WhatsApp',
  },
  '/assinatura': {
    title: 'Assinatura e Planos',
    subtitle: 'Gestão de conta e faturamento',
  },
};

export function getPageTitle(pathname: string): { title: string; subtitle: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find(
    (key) => key !== '/' && pathname.startsWith(key)
  );
  if (match) return PAGE_TITLES[match];
  return PAGE_TITLES['/'];
}
