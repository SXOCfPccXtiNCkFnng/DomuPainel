import { TenantSegment } from '@/types';
import { getAuthItem } from '@/lib/authStorage';

export const SEGMENT_LABELS: Record<TenantSegment, string> = {
  imobiliario: 'Imobiliário',
  ecommerce: 'E-commerce',
  saude: 'Saúde e Beleza',
  alimentacao: 'Alimentação',
  automotivo: 'Lava Rápido e Estética Automotiva',
  juridico: 'Jurídico',
  marketing_apenas: 'Somente Disparos',
  geral: 'Geral',
};

export const SEGMENT_WELCOME: Record<TenantSegment, string> = {
  imobiliario: 'Automatize lançamentos, leads e visitas pelo WhatsApp.',
  ecommerce: 'Recupere carrinhos, envie ofertas e notifique seus clientes.',
  saude: 'Confirme consultas, horários e retornos com mensagens automáticas.',
  alimentacao: 'Receba pedidos, confirme entregas e fidelize clientes no WhatsApp.',
  automotivo: 'Agende lavagens, avise quando o carro estiver pronto e traga o cliente de volta.',
  juridico: 'Gerencie prazos, cobranças e comunicação com clientes.',
  marketing_apenas: 'Foque em campanhas e disparos em massa no WhatsApp.',
  geral: 'Automatize comunicação e engajamento com seus clientes.',
};

/**
 * Ramos de negócio (business_segment). Quem começa no Somente Disparos também
 * informa o ramo: no upgrade a conta vai para o módulo desse ramo.
 * Ao criar um módulo novo (ex.: barbearia própria), adicione aqui.
 */
export const BUSINESS_SEGMENT_OPTIONS: { id: TenantSegment; label: string }[] = [
  { id: 'imobiliario', label: 'Imobiliário (imobiliárias e corretores)' },
  { id: 'saude', label: 'Saúde e Beleza (barbearia, salão, clínica)' },
  { id: 'alimentacao', label: 'Alimentação (pizzaria, restaurante, delivery)' },
  { id: 'automotivo', label: 'Automotivo (lava rápido, estética automotiva)' },
  { id: 'ecommerce', label: 'E-commerce e Varejo' },
  { id: 'geral', label: 'Serviços, Jurídico e Outros' },
];

export function isValidBusinessSegment(value: unknown): value is TenantSegment {
  return BUSINESS_SEGMENT_OPTIONS.some((opt) => opt.id === value);
}

export function isRealEstateSegment(segment: TenantSegment | string | null): boolean {
  return segment === 'imobiliario';
}

/** Segmento focado só em campanhas — sem imóveis/leads/CRM. */
export function isDispatchOnlySegment(segment: TenantSegment | string | null): boolean {
  return segment === 'marketing_apenas';
}

export function isAutomotiveSegment(segment: TenantSegment | string | null): boolean {
  return segment === 'automotivo';
}

/** Ramos onde o Follow-up Automático não faz sentido (ex.: lava rápido). */
const SEGMENTS_WITHOUT_FOLLOW_UP: TenantSegment[] = ['automotivo'];

export function hasFollowUp(segment: TenantSegment | string | null): boolean {
  return !SEGMENTS_WITHOUT_FOLLOW_UP.includes(segment as TenantSegment);
}

export function getSegmentFromStorage(): TenantSegment {
  if (typeof window === 'undefined') return 'geral';
  const saved = getAuthItem('domu_selected_segment') as TenantSegment | null;
  return saved && saved in SEGMENT_LABELS ? saved : 'geral';
}

export type NavItemId =
  | 'dashboard'
  | 'agenda'
  | 'atendente'
  | 'servicos'
  | 'disparos'
  | 'templates'
  | 'contatos'
  | 'followup'
  | 'metricas'
  | 'atendimento'
  | 'imoveis'
  | 'leads'
  | 'visitas'
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
    id: 'agenda',
    name: 'Agenda',
    href: '/agenda',
    isComingSoon: false,
    segments: ['automotivo'],
  },
  {
    id: 'atendente',
    name: 'Atendente IA',
    href: '/atendente',
    isComingSoon: false,
    segments: ['automotivo'],
  },
  {
    id: 'disparos',
    name: 'Disparo de Campanha',
    href: '/disparos',
    isComingSoon: false,
  },
  {
    id: 'followup',
    name: 'Follow-up Automático',
    href: '/follow-up',
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
    badge: 'Em breve',
    isComingSoon: true,
    segments: ['imobiliario'],
  },
  {
    id: 'atendimento',
    name: 'Leads e Respostas',
    href: '/atendimento',
    badge: 'Em breve',
    isComingSoon: true,
  },
];

export const ADMIN_NAV: NavItemConfig[] = [
  { id: 'relatorios', name: 'Relatórios de Análise', href: '/relatorios', isComingSoon: false },
  { id: 'configuracoes', name: 'Configurações', href: '/configuracoes', isComingSoon: false },
  { id: 'assinatura', name: 'Assinatura e Planos', href: '/assinatura', isComingSoon: false },
];

export type NavSection = { title: string; items: NavItemConfig[] };

/**
 * Imobiliário: menu por etapa do trabalho do corretor. Visitas aparece para
 * todos com a etiqueta Pro (no Starter a página explica como liberar).
 */
const REAL_ESTATE_NAV: NavSection[] = [
  {
    title: 'Vendas',
    items: [
      { id: 'dashboard', name: 'Painel', href: '/', isComingSoon: false },
      { id: 'imoveis', name: 'Imóveis', href: '/imoveis', isComingSoon: false },
      { id: 'leads', name: 'Leads', href: '/leads', isComingSoon: false },
      { id: 'atendente', name: 'Atendente IA', href: '/atendente', isComingSoon: false },
      { id: 'visitas', name: 'Visitas', href: '/visitas', badge: 'Pro', isComingSoon: false },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { id: 'disparos', name: 'Campanhas', href: '/disparos', isComingSoon: false },
      { id: 'followup', name: 'Follow-up', href: '/follow-up', isComingSoon: false },
      { id: 'templates', name: 'Modelos de mensagem', href: '/templates', isComingSoon: false },
      { id: 'contatos', name: 'Contatos', href: '/contatos', isComingSoon: false },
    ],
  },
  {
    title: 'Resultados',
    items: [
      { id: 'metricas', name: 'Resultados', href: '/metricas', isComingSoon: false },
      { id: 'relatorios', name: 'Relatório de envios', href: '/relatorios', isComingSoon: false },
    ],
  },
  {
    title: 'Conta',
    items: [
      { id: 'configuracoes', name: 'Configurações', href: '/configuracoes', isComingSoon: false },
      { id: 'assinatura', name: 'Assinatura', href: '/assinatura', isComingSoon: false },
    ],
  },
];

/** Lava rápido: menu pela rotina da loja (agenda e atendente primeiro). */
const AUTOMOTIVE_NAV: NavSection[] = [
  {
    title: 'Atendimento',
    items: [
      { id: 'dashboard', name: 'Painel', href: '/', isComingSoon: false },
      { id: 'agenda', name: 'Agenda', href: '/agenda', isComingSoon: false },
      { id: 'atendente', name: 'Atendente IA', href: '/atendente', isComingSoon: false },
      { id: 'servicos', name: 'Serviços e horários', href: '/servicos', isComingSoon: false },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { id: 'disparos', name: 'Campanhas', href: '/disparos', isComingSoon: false },
      { id: 'templates', name: 'Modelos de mensagem', href: '/templates', isComingSoon: false },
      { id: 'contatos', name: 'Contatos', href: '/contatos', isComingSoon: false },
    ],
  },
  REAL_ESTATE_NAV[2], // Resultados
  REAL_ESTATE_NAV[3], // Conta
];

/** Seções do menu lateral para o ramo da conta. */
export function getNavSectionsForSegment(segment: TenantSegment): NavSection[] {
  if (isRealEstateSegment(segment)) return REAL_ESTATE_NAV;
  if (isAutomotiveSegment(segment)) return AUTOMOTIVE_NAV;
  return [
    { title: 'Plataforma', items: getPlatformNavForSegment(segment) },
    { title: 'Administração', items: ADMIN_NAV },
  ];
}

export function getPlatformNavForSegment(segment: TenantSegment): NavItemConfig[] {
  const dispatchOnly = isDispatchOnlySegment(segment);

  return PLATFORM_NAV.filter((item) => {
    if (item.segments && !item.segments.includes(segment)) return false;
    if (item.id === 'followup' && !hasFollowUp(segment)) return false;
    // No automotivo, a atendente do WhatsApp já funciona (página Atendente IA).
    if (item.id === 'atendimento' && isAutomotiveSegment(segment)) return false;
    return true;
  }).map((item) => {
    if (dispatchOnly && item.id === 'metricas') {
      return { ...item, name: 'Métricas de Campanha' };
    }
    if (dispatchOnly && item.id === 'contatos') {
      return { ...item, name: 'Contatos' };
    }
    return item;
  });
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
  '/follow-up': {
    title: 'Follow-up Automático',
    subtitle: 'Mensagem automática para quem não respondeu',
  },
  '/atendimento': {
    title: 'Leads e Respostas',
    subtitle: 'Quem respondeu às campanhas e em que etapa está',
  },
  '/agenda': {
    title: 'Agenda',
    subtitle: 'Agendamentos do dia',
  },
  '/servicos': {
    title: 'Serviços e horários',
    subtitle: 'O que a loja oferece, quando atende e os lembretes para o cliente',
  },
  '/atendente': {
    title: 'Atendente IA',
    subtitle: 'Atendente do WhatsApp, serviços e horário de funcionamento',
  },
  '/imoveis': {
    title: 'Imóveis',
    subtitle: 'Catálogo que a atendente consulta e que vira campanha',
  },
  '/leads': {
    title: 'Leads',
    subtitle: 'Quem conversou, o que procura e em que etapa está',
  },
  '/visitas': {
    title: 'Visitas',
    subtitle: 'Pedidos de visita feitos pela atendente para você confirmar',
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

const DISPATCH_ONLY_PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard de Disparos',
    subtitle: 'Campanhas, entregas e performance no WhatsApp',
  },
  '/metricas': {
    title: 'Métricas de Campanha',
    subtitle: 'Disparos, entregas, respostas e base de contatos',
  },
  '/contatos': {
    title: 'Contatos',
    subtitle: 'Importação e listas para suas campanhas',
  },
  '/disparos': {
    title: 'Disparo de Campanha',
    subtitle: 'Monte, agende e acompanhe envios com status Meta',
  },
  '/templates': {
    title: 'Templates de Mensagens',
    subtitle: 'Modelos aprovados pela Meta para seus disparos',
  },
  '/relatorios': {
    title: 'Relatórios de Campanha',
    subtitle: 'Histórico de envios e entregas',
  },
};

const AUTOMOTIVE_PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Painel',
    subtitle: 'Disparos, respostas, clientes e lavagens agendadas',
  },
  '/atendente': {
    title: 'Atendente IA',
    subtitle: 'Quem responde e agenda seus clientes no WhatsApp a qualquer hora',
  },
  '/metricas': {
    title: 'Resultados',
    subtitle: 'Atingidos, taxa de resposta, clientes que voltaram e agendamentos',
  },
  '/relatorios': {
    title: 'Relatório de envios',
    subtitle: 'Histórico de campanhas e entregas',
  },
  '/contatos': {
    title: 'Contatos',
    subtitle: 'Importação e listas por serviço, veículo e frequência de visita',
  },
  '/disparos': {
    title: 'Campanhas',
    subtitle: 'Promoção → público → agendar → enviar com status Meta',
  },
  '/templates': {
    title: 'Modelos de mensagem',
    subtitle: 'Modelos aprovados pela Meta para suas campanhas',
  },
};

const REAL_ESTATE_PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Painel',
    subtitle: 'Campanhas, leads e visitas da sua imobiliária',
  },
  '/atendente': {
    title: 'Atendente IA',
    subtitle: 'Quem responde seus clientes no WhatsApp a qualquer hora',
  },
  '/disparos': {
    title: 'Campanhas',
    subtitle: 'Imóvel → público → agendar → enviar com status Meta',
  },
  '/templates': {
    title: 'Modelos de mensagem',
    subtitle: 'Modelos aprovados pela Meta para suas campanhas',
  },
  '/contatos': {
    title: 'Contatos',
    subtitle: 'Importação e listas por interesse, região e faixa de valor',
  },
  '/metricas': {
    title: 'Resultados',
    subtitle: 'Alcance, respostas, leads e visitas',
  },
  '/relatorios': {
    title: 'Relatório de envios',
    subtitle: 'Histórico de campanhas e entregas',
  },
};

export function getPageTitle(
  pathname: string,
  segment?: TenantSegment | string | null
): { title: string; subtitle: string } {
  const override = isDispatchOnlySegment(segment || null)
    ? DISPATCH_ONLY_PAGE_TITLES
    : isAutomotiveSegment(segment || null)
      ? AUTOMOTIVE_PAGE_TITLES
      : isRealEstateSegment(segment || null)
        ? REAL_ESTATE_PAGE_TITLES
        : null;
  const titles =
    override && override[pathname] ? { ...PAGE_TITLES, ...override } : PAGE_TITLES;

  if (titles[pathname]) return titles[pathname];
  const match = Object.keys(titles).find(
    (key) => key !== '/' && pathname.startsWith(key)
  );
  if (match) return titles[match];
  return titles['/'] || PAGE_TITLES['/'];
}
