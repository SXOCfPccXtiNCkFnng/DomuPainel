import { TenantSegment } from '@/types';
import { getAuthItem } from '@/lib/authStorage';

export const SEGMENT_LABELS: Record<TenantSegment, string> = {
  imobiliario: 'Imobiliário',
  ecommerce: 'E-commerce',
  saude: 'Saúde e Beleza',
  alimentacao: 'Alimentação',
  juridico: 'Jurídico',
  marketing_apenas: 'Marketing',
  geral: 'Geral',
};

export const SEGMENT_WELCOME: Record<TenantSegment, string> = {
  imobiliario: 'Automatize lançamentos, leads e visitas pelo WhatsApp.',
  ecommerce: 'Recupere carrinhos, envie ofertas e notifique seus clientes.',
  saude: 'Confirme consultas, horários e retornos com mensagens automáticas.',
  alimentacao: 'Receba pedidos, confirme entregas e fidelize clientes no WhatsApp.',
  juridico: 'Gerencie prazos, cobranças e comunicação com clientes.',
  marketing_apenas: 'Foque em campanhas e disparos em massa no WhatsApp.',
  geral: 'Automatize comunicação e engajamento com seus clientes.',
};

export function isRealEstateSegment(segment: TenantSegment | string | null): boolean {
  return segment === 'imobiliario';
}

export function getSegmentFromStorage(): TenantSegment {
  if (typeof window === 'undefined') return 'geral';
  const saved = getAuthItem('domu_selected_segment') as TenantSegment | null;
  return saved && saved in SEGMENT_LABELS ? saved : 'geral';
}

export type NavItemId =
  | 'dashboard'
  | 'disparos'
  | 'templates'
  | 'contatos'
  | 'metricas'
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
  {
    id: 'disparos',
    name: 'Disparo de Campanha',
    href: '/disparos',
    isComingSoon: false,
  },
  {
    id: 'metricas',
    name: 'Métricas de ROI',
    href: '/metricas',
    isComingSoon: false,
  },
  { id: 'templates', name: 'Templates de Mensagens', href: '/templates', isComingSoon: false },
  {
    id: 'contatos',
    name: 'Contatos e Segmentação',
    href: '/contatos',
    isComingSoon: false,
  },
  {
    id: 'imoveis',
    name: 'Imóveis',
    href: '/imoveis',
    badge: 'Em Breve',
    isComingSoon: true,
    segments: ['imobiliario'],
  },
  {
    id: 'atendimento',
    name: 'Leads e Respostas',
    href: '/atendimento',
    badge: 'Em Breve',
    isComingSoon: true,
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
    title: 'Dashboard',
    subtitle: 'ROI do corretor: disparos, respostas, leads e visitas',
  },
  '/metricas': {
    title: 'Métricas de ROI',
    subtitle: 'Atingidos, taxa de resposta, leads qualificados e visitas agendadas',
  },
  '/contatos': {
    title: 'Contatos e Segmentação',
    subtitle: 'Importação e tags por interesse, região e faixa de preço',
  },
  '/disparos': {
    title: 'Disparo de Campanha',
    subtitle: 'Imóvel → segmento → agendar → enviar com status Meta',
  },
  '/templates': {
    title: 'Templates de Mensagens',
    subtitle: 'Gerencie modelos aprovados pela Meta para seus disparos',
  },
  '/atendimento': {
    title: 'Leads e Respostas',
    subtitle: 'Quem respondeu às campanhas e em que etapa está',
  },
  '/imoveis': {
    title: 'Imóveis',
    subtitle: 'Cadastro enxuto para alimentar campanhas e busca por perfil',
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
