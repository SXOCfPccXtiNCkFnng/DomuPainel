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

export const DEFAULT_TEMPLATES: Record<TenantSegment, string> = {
  automotivo:
    'Oi, tudo bem? Vi o {nome} aqui no Google. A gente criou uma atendente no WhatsApp para lava-rápido e estética automotiva: ela responde os clientes na hora e já agenda os horários sozinha, até de madrugada. Posso te mandar um vídeo rapidinho mostrando?',
  saude:
    'Oi, tudo bem? Vi o {nome} aqui no Google. A gente tem uma plataforma que ajuda a lotar a agenda pelo WhatsApp: lembretes, promoções para quem sumiu e atendimento organizado. Posso te mostrar em 2 minutinhos?',
  imobiliario:
    'Oi, tudo bem? Vi a {nome} aqui no Google. A gente tem uma plataforma de WhatsApp para imobiliárias: envia os imóveis para a base de clientes e organiza os leads que chegam. Posso te mostrar como funciona?',
  alimentacao:
    'Oi, tudo bem? Vi o {nome} aqui no Google. A gente ajuda restaurantes da região a vender mais pelo WhatsApp, mandando o cardápio e as promoções do dia para os clientes. Posso te mostrar como funciona?',
  juridico:
    'Olá, tudo bem? Vi o {nome} aqui no Google. Temos uma plataforma que organiza o atendimento do escritório pelo WhatsApp e mantém os clientes informados. Posso apresentar em poucos minutos?',
  ecommerce:
    'Oi, tudo bem? Vi a {nome} aqui no Google. A gente ajuda lojas a vender mais pelo WhatsApp, avisando os clientes das novidades e promoções. Posso te mostrar como funciona?',
  marketing_apenas:
    'Oi, tudo bem? Vi o {nome} aqui no Google. A gente tem uma plataforma para enviar promoções pelo WhatsApp para os seus clientes. Posso te mostrar?',
  geral:
    'Oi, tudo bem? Vi o {nome} aqui no Google. A gente tem uma plataforma que ajuda empresas de {cidade} a vender mais pelo WhatsApp. Posso te mostrar em 2 minutinhos?',
};

export function fillTemplate(template: string, vars: { nome: string; cidade?: string | null }): string {
  return template
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{cidade\}/g, vars.cidade || 'sua cidade');
}
