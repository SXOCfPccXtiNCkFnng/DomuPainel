/**
 * Prospecção de estabelecimentos (/interno). Regras puras: tipos buscados,
 * cidades da região, telefone, Instagram e mensagens prontas.
 */
import type { TenantSegment } from '@/types';

export type ProspectKind = {
  id: string;
  label: string;
  /** Termo usado na busca do Google ("lava rápido em Itu - SP"). */
  query: string;
  module: TenantSegment;
};

export const PROSPECT_KINDS: ProspectKind[] = [
  { id: 'lava_rapido', label: 'Lava-rápido', query: 'lava rápido', module: 'automotivo' },
  { id: 'estetica_automotiva', label: 'Estética automotiva', query: 'estética automotiva', module: 'automotivo' },
  { id: 'salao', label: 'Salão de beleza', query: 'salão de beleza', module: 'saude' },
  { id: 'barbearia', label: 'Barbearia', query: 'barbearia', module: 'saude' },
  { id: 'estetica', label: 'Clínica de estética', query: 'clínica de estética', module: 'saude' },
  { id: 'manicure', label: 'Manicure e unhas', query: 'esmalteria manicure', module: 'saude' },
  { id: 'dentista', label: 'Dentista', query: 'dentista', module: 'saude' },
  { id: 'clinica', label: 'Clínica médica', query: 'clínica médica', module: 'saude' },
  { id: 'fisioterapia', label: 'Fisioterapia e pilates', query: 'fisioterapia pilates', module: 'saude' },
  { id: 'imobiliaria', label: 'Imobiliária', query: 'imobiliária', module: 'imobiliario' },
  { id: 'restaurante', label: 'Restaurante', query: 'restaurante', module: 'alimentacao' },
  { id: 'pizzaria', label: 'Pizzaria', query: 'pizzaria', module: 'alimentacao' },
  { id: 'hamburgueria', label: 'Hamburgueria', query: 'hamburgueria', module: 'alimentacao' },
  { id: 'acai', label: 'Açaí e sorveteria', query: 'açaí sorveteria', module: 'alimentacao' },
  { id: 'lanchonete', label: 'Lanchonete e dogão', query: 'lanchonete cachorro quente', module: 'alimentacao' },
  { id: 'marmitaria', label: 'Marmitaria', query: 'marmitaria', module: 'alimentacao' },
  { id: 'japonesa', label: 'Comida japonesa', query: 'restaurante japonês delivery', module: 'alimentacao' },
  { id: 'advocacia', label: 'Escritório de advocacia', query: 'escritório de advocacia', module: 'juridico' },
  { id: 'loja_roupas', label: 'Loja de roupas', query: 'loja de roupas', module: 'ecommerce' },
  { id: 'pet_shop', label: 'Pet shop', query: 'pet shop', module: 'geral' },
  { id: 'academia', label: 'Academia', query: 'academia', module: 'geral' },
];

export const PROSPECT_KIND_IDS = new Set(PROSPECT_KINDS.map((k) => k.id));

export function prospectKind(id: string): ProspectKind | undefined {
  return PROSPECT_KINDS.find((k) => k.id === id);
}

/** Região de São Roque - SP e cidades próximas. */
export const REGION_CITIES = [
  'São Roque',
  'Mairinque',
  'Alumínio',
  'Araçariguama',
  'Ibiúna',
  'Vargem Grande Paulista',
  'Sorocaba',
  'Votorantim',
  'Itu',
  'Salto',
  'Cabreúva',
  'Pirapora do Bom Jesus',
  'Itapevi',
  'Cotia',
] as const;

export const DEFAULT_CITIES = ['São Roque', 'Mairinque', 'Sorocaba', 'Itu'];

export const REGION_CITY_SET = new Set<string>(REGION_CITIES);

/** Busca repetida antes disso reaproveita o que já está salvo (e não gasta cota). */
export const SEARCH_REUSE_DAYS = 30;

export function buildSearchQuery(kind: ProspectKind, city: string): string {
  return `${kind.query} em ${city} - SP`;
}

export const PROSPECT_STATUSES = [
  'NEW',
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'CLIENT',
  'NOT_INTERESTED',
  'INVALID',
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  REPLIED: 'Respondeu',
  INTERESTED: 'Interessado',
  CLIENT: 'Virou cliente',
  NOT_INTERESTED: 'Não quer',
  INVALID: 'Número inválido',
};

export function isProspectStatus(v: unknown): v is ProspectStatus {
  return typeof v === 'string' && (PROSPECT_STATUSES as readonly string[]).includes(v);
}

// ───────── Telefone ─────────

/** Só dígitos, sem o 55 do Brasil (quando dá para saber que é o DDI). */
export function nationalDigits(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d.slice(2);
  return d;
}

/** Celular = DDD + 9 dígitos começando com 9. */
export function isBrazilMobile(raw: string | null | undefined): boolean {
  const d = nationalDigits(raw);
  return d.length === 11 && d[2] === '9';
}

/** Número para o link wa.me (55 + DDD + número) ou null se não parecer válido. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const d = nationalDigits(raw);
  if (d.length !== 10 && d.length !== 11) return null;
  return `55${d}`;
}

/** Chave para comparar telefones escritos de jeitos diferentes (com/sem 9, com/sem 55). */
export function phoneKey(raw: string | null | undefined): string | null {
  const d = nationalDigits(raw);
  if (d.length !== 10 && d.length !== 11) return null;
  return `${d.slice(0, 2)}${d.slice(-8)}`;
}

// ───────── Instagram ─────────

const INSTAGRAM_RESERVED = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'explore',
  'accounts',
  'stories',
  'direct',
  'about',
  'legal',
  'developer',
  'sharer',
  'share',
  'web',
  'instagram',
]);

function validHandle(h: string | undefined): string | null {
  if (!h) return null;
  const handle = h.replace(/\.+$/, '').toLowerCase();
  if (!/^[a-z0-9_.]{2,30}$/.test(handle) || INSTAGRAM_RESERVED.has(handle)) return null;
  return handle;
}

/** "https://www.instagram.com/lavajato.sr/?hl=pt" → "lavajato.sr". */
export function instagramFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    return validHandle(u.pathname.split('/').filter(Boolean)[0]);
  } catch {
    return null;
  }
}

/** Primeiro perfil do Instagram citado no HTML de um site. */
export function extractInstagramFromHtml(html: string): string | null {
  const re = /instagram\.com\/([A-Za-z0-9_.]{2,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const handle = validHandle(m[1]);
    if (handle) return handle;
  }
  return null;
}

/** IP de rede interna/local: nunca buscar (evita SSRF ao abrir sites de terceiros). */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, '');
  const m = v4.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

// ───────── Google Places → linha salva ─────────

export type PlacesPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
};

export type ProspectRow = {
  place_id: string;
  name: string;
  kind: string;
  module: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  phone_intl: string | null;
  is_mobile: boolean;
  website: string | null;
  instagram: string | null;
  maps_url: string | null;
  rating: number | null;
  rating_count: number | null;
  business_status: string | null;
  search_city: string;
};

function cityOf(p: PlacesPlace): string | null {
  const comps = p.addressComponents || [];
  const byType = (t: string) => comps.find((c) => c.types?.includes(t))?.longText;
  return byType('administrative_area_level_2') || byType('locality') || null;
}

const cut = (s: string | null | undefined, max: number) => (s ? s.slice(0, max) : null);

export function placeToProspect(p: PlacesPlace, kind: ProspectKind, searchCity: string): ProspectRow | null {
  const name = p.displayName?.text?.trim();
  if (!p.id || !name) return null;
  const phone = p.nationalPhoneNumber || null;
  return {
    place_id: p.id.slice(0, 300),
    name: name.slice(0, 300),
    kind: kind.id,
    module: kind.module,
    city: cut(cityOf(p), 120),
    address: cut(p.formattedAddress, 500),
    phone: cut(phone, 40),
    phone_intl: cut(p.internationalPhoneNumber, 40),
    is_mobile: isBrazilMobile(p.internationalPhoneNumber || phone),
    website: cut(p.websiteUri, 1000),
    instagram: instagramFromUrl(p.websiteUri),
    maps_url: cut(p.googleMapsUri, 1000),
    rating: typeof p.rating === 'number' ? p.rating : null,
    rating_count: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    business_status: cut(p.businessStatus, 40),
    search_city: searchCity,
  };
}

// ───────── Mensagens prontas ─────────

/** Nome da vendedora da Domu: assina a abordagem e é quem continua a conversa. */
export const SALES_AGENT_NAME = 'Júlia';

/** Mensagem pronta por módulo (quando o tipo do estabelecimento não tem uma própria). */
export const DEFAULT_TEMPLATES: Record<TenantSegment, string> = {
  automotivo: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para lava rápido, que responde seus clientes no WhatsApp na hora, passa os valores e já agenda a lavagem sozinha, até no domingo. Posso te mostrar como funcionaria aí com vocês?",
  saude: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para o seu tipo de negócio, que responde seus clientes no WhatsApp na hora, marca o horário sozinha e manda lembrete para ninguém esquecer. Posso te mostrar como funcionaria aí com vocês?",
  imobiliario: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para imobiliárias, que responde os interessados no WhatsApp na hora, mostra os imóveis com valores e entrega o cliente pronto para o corretor. Nenhum lead fica sem resposta. Posso te mostrar como funciona?",
  alimentacao: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para delivery, que mostra o cardápio, anota o pedido com o valor certo e manda direto para a cozinha, até no pico de sexta à noite. Posso te mostrar como funcionaria aí com vocês?",
  juridico: "Olá, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda escritórios a manter os clientes informados pelo WhatsApp oficial, com mensagens organizadas e sem risco de bloqueio do número. Posso te apresentar em poucos minutos?",
  ecommerce: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda lojas a vender mais pelo WhatsApp oficial, avisando toda a lista de clientes das novidades e promoções de uma vez, sem risco de bloqueio. Posso te mostrar como funciona?",
  marketing_apenas: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda empresas a mandar promoções para toda a lista de clientes pelo WhatsApp oficial, de uma vez e sem risco de bloqueio. Posso te mostrar como funciona?",
  geral: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda empresas de {cidade} a vender mais pelo WhatsApp oficial, mandando promoções e novidades para toda a lista de clientes de uma vez, sem risco de bloqueio. Posso te mostrar como funciona?",
};

/** Mensagem pronta por tipo de estabelecimento (barbearia, pizzaria...): fala a língua do nicho. */
export const DEFAULT_KIND_TEMPLATES: Record<string, string> = {
  lava_rapido: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para lava rápido, que responde seus clientes no WhatsApp na hora, passa os valores e já agenda a lavagem sozinha, até no domingo. Posso te mostrar como funcionaria aí com vocês?",
  estetica_automotiva: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para estética automotiva, que responde seus clientes na hora, explica os serviços e já agenda sozinha, sem você largar o carro que está fazendo. Posso te mostrar como funcionaria aí com vocês?",
  barbearia: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para barbearia, que responde seus clientes enquanto você está na cadeira, marca o horário sozinha e manda lembrete para ninguém faltar. Posso te mostrar como funcionaria aí com vocês?",
  salao: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para salão de beleza, que responde suas clientes no WhatsApp na hora, marca o horário sozinha e manda lembrete para ninguém faltar. Posso te mostrar como funcionaria aí com vocês?",
  estetica: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para clínicas de estética, que responde suas clientes na hora, tira dúvidas sobre horários e já agenda a avaliação sozinha, com lembrete antes. Posso te mostrar como funcionaria aí com vocês?",
  manicure: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para manicure e esmalteria, que responde suas clientes enquanto você está atendendo, marca o horário sozinha e manda lembrete. Posso te mostrar como funcionaria aí com vocês?",
  dentista: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para consultórios odontológicos, que responde os pacientes no WhatsApp na hora, marca a consulta sozinha e manda lembrete para diminuir as faltas. Posso te mostrar como funcionaria aí com vocês?",
  clinica: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para clínicas, que responde os pacientes no WhatsApp na hora, agenda a consulta sozinha e manda lembrete para diminuir as faltas. Posso te mostrar como funcionaria aí com vocês?",
  fisioterapia: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para fisioterapia e pilates, que responde seus alunos e pacientes na hora, marca as sessões sozinha e manda lembrete antes de cada uma. Posso te mostrar como funcionaria aí com vocês?",
  imobiliaria: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para imobiliárias, que responde os interessados no WhatsApp na hora, mostra os imóveis com valores e entrega o cliente pronto para o corretor. Nenhum lead fica sem resposta. Posso te mostrar como funciona?",
  restaurante: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para restaurantes, que responde os clientes na hora, mostra o cardápio e já anota o pedido com o valor certo, direto para a cozinha. Posso te mostrar como funcionaria aí com vocês?",
  pizzaria: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para pizzaria, que mostra o cardápio, anota o pedido com meio a meio e o valor certo e manda direto para a cozinha, até no pico de sexta à noite. Posso te mostrar como funcionaria aí com vocês?",
  hamburgueria: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para hamburgueria, que mostra o cardápio, anota o pedido com os adicionais e o valor certo e manda direto para a cozinha. Posso te mostrar como funcionaria aí com vocês?",
  acai: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para açaí e sorveteria, que mostra o cardápio, anota o pedido com os complementos e o valor certo e avisa o cliente quando sai para entrega. Posso te mostrar como funcionaria aí com vocês?",
  lanchonete: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para lanchonete, que responde na hora, anota os pedidos com o valor certo e manda para a cozinha, sem você parar a chapa. Posso te mostrar como funcionaria aí com vocês?",
  marmitaria: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para marmitaria, que mostra o cardápio do dia, anota as marmitas com o valor certo e organiza os pedidos do almoço. Posso te mostrar como funcionaria aí com vocês?",
  japonesa: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente tem uma atendente virtual humanizada, treinada para comida japonesa, que mostra o cardápio, anota os combos com o valor certo e avisa o cliente a cada etapa do pedido. Posso te mostrar como funcionaria aí com vocês?",
  advocacia: "Olá, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda escritórios de advocacia a manter os clientes informados pelo WhatsApp oficial, com mensagens organizadas e sem risco de bloqueio do número. Posso te apresentar em poucos minutos?",
  loja_roupas: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda lojas de roupas a vender mais pelo WhatsApp oficial, avisando toda a lista de clientes das novidades e promoções de uma vez, sem risco de bloqueio. Posso te mostrar como funciona?",
  pet_shop: "Oi, tudo bem? Vi o {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda pet shops a vender mais pelo WhatsApp oficial, mandando promoções e novidades para toda a lista de clientes de uma vez, sem risco de bloqueio. Posso te mostrar como funciona?",
  academia: "Oi, tudo bem? Vi a {nome} aqui no Google. Sou a {atendente}, da Domu. A gente ajuda academias a falar com todos os alunos pelo WhatsApp oficial, mandando avisos e promoções e trazendo de volta quem parou, sem risco de bloqueio. Posso te mostrar como funciona?",
};

export function fillTemplate(template: string, vars: { nome: string; cidade?: string | null; atendente?: string }): string {
  return template
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{cidade\}/g, vars.cidade || 'sua cidade')
    .replace(/\{atendente\}/g, vars.atendente || SALES_AGENT_NAME);
}
