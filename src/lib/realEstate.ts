/**
 * Módulo imobiliário (imobiliárias, corretores e construtoras). Regras puras:
 * usadas pela tela, pela API e pela atendente de IA.
 */
import { normalizePlanTier } from '@/lib/planLimits';

export const PROPERTY_TYPES = [
  'Apartamento',
  'Casa',
  'Casa em condomínio',
  'Cobertura',
  'Terreno',
  'Comercial',
  'Chácara',
  'Galpão',
] as const;

export const PROPERTY_PURPOSES = ['VENDA', 'ALUGUEL', 'VENDA_E_ALUGUEL'] as const;
export type PropertyPurpose = (typeof PROPERTY_PURPOSES)[number];

export const PURPOSE_LABELS: Record<PropertyPurpose, string> = {
  VENDA: 'Venda',
  ALUGUEL: 'Aluguel',
  VENDA_E_ALUGUEL: 'Venda e aluguel',
};

/** Os textos ficam como já estavam no banco. */
export const PROPERTY_STATUSES = ['Disponível', 'Lançamento', 'Reservado', 'Vendido', 'Alugado'] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

/** O que a IA pode oferecer. Reservado/vendido/alugado ficam fora da busca. */
export const OFFERABLE_STATUSES: PropertyStatus[] = ['Disponível', 'Lançamento'];

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1500;
export const FEATURES_MAX = 15;
export const FEATURE_MAX = 40;
export const LINK_MAX = 500;
const MONEY_MAX = 999_999_999;

export type RealEstateProperty = {
  id: string;
  code: string;
  title: string;
  type: string;
  purpose: PropertyPurpose;
  status: PropertyStatus;
  price: number;
  rent_price: number | null;
  condo_fee: number | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number;
  bathrooms: number;
  parking_spots: number;
  area_sqm: number;
  description: string | null;
  features: string[];
  link_url: string | null;
};

export type PropertyFields = Omit<RealEstateProperty, 'id' | 'code'> & { code: string | null };

function toMoney(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  // Número já vem pronto; texto aceita "450.000", "450.000,50" e "1500.5".
  const raw = String(value).replace(/[R$\s]/g, '');
  const n =
    typeof value === 'number'
      ? value
      : Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d+\.\d{1,2}$/.test(raw) ? raw : raw.replace(/\./g, ''));
  if (!Number.isFinite(n) || n < 0 || n > MONEY_MAX) return 'invalid';
  return Math.round(n * 100) / 100;
}

function toCount(value: unknown, max: number): number | 'invalid' {
  if (value === undefined || value === null || String(value).trim() === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) return 'invalid';
  return n;
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<{2,}|>{2,}/g, '')
    .trim()
    .slice(0, max);
}

/** Só http(s): o link vai para o cliente final pelo WhatsApp. */
export function normalizeLink(value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.length > LINK_MAX) return 'invalid';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'invalid';
    if (!url.hostname.includes('.') || url.username || url.password) return 'invalid';
    return url.toString();
  } catch {
    return 'invalid';
  }
}

export function validatePropertyInput(
  input: Record<string, unknown>
): { ok: true; fields: PropertyFields } | { ok: false; error: string } {
  const title = cleanText(input.title, TITLE_MAX);
  if (title.length < 3) return { ok: false, error: 'Dê um título ao imóvel (ex.: Apartamento 2 quartos no Centro).' };

  const type = String(input.type ?? '');
  if (!(PROPERTY_TYPES as readonly string[]).includes(type) && type !== 'Lote') {
    return { ok: false, error: 'Escolha o tipo do imóvel.' };
  }
  const purpose = String(input.purpose ?? 'VENDA') as PropertyPurpose;
  if (!PROPERTY_PURPOSES.includes(purpose)) return { ok: false, error: 'Escolha se é venda ou aluguel.' };
  const status = String(input.status ?? 'Disponível') as PropertyStatus;
  if (!PROPERTY_STATUSES.includes(status)) return { ok: false, error: 'Situação do imóvel inválida.' };

  const price = toMoney(input.price);
  if (price === 'invalid' || price === null || price <= 0) {
    return { ok: false, error: purpose === 'ALUGUEL' ? 'Informe o valor do aluguel.' : 'Informe o valor do imóvel.' };
  }
  const rent = toMoney(input.rent_price);
  if (rent === 'invalid') return { ok: false, error: 'Valor do aluguel inválido.' };
  if (purpose === 'VENDA_E_ALUGUEL' && !rent) return { ok: false, error: 'Informe também o valor do aluguel.' };
  const condo = toMoney(input.condo_fee);
  if (condo === 'invalid') return { ok: false, error: 'Valor do condomínio inválido.' };

  const bedrooms = toCount(input.bedrooms, 50);
  const bathrooms = toCount(input.bathrooms, 50);
  const parking = toCount(input.parking_spots, 100);
  if (bedrooms === 'invalid' || bathrooms === 'invalid' || parking === 'invalid') {
    return { ok: false, error: 'Quartos, banheiros e vagas precisam ser números inteiros.' };
  }
  const area = toMoney(input.area_sqm);
  if (area === 'invalid') return { ok: false, error: 'Área inválida.' };

  const link = normalizeLink(input.link_url);
  if (link === 'invalid') return { ok: false, error: 'Link do anúncio inválido. Use o endereço completo (https://...).' };

  const rawFeatures = Array.isArray(input.features)
    ? input.features
    : String(input.features ?? '').split(/[,\n]/);
  const features = [
    ...new Set(rawFeatures.map((f) => cleanText(f, FEATURE_MAX).replace(/\s+/g, ' ')).filter((f) => f.length >= 2)),
  ].slice(0, FEATURES_MAX);

  const code = cleanText(input.code, 50).replace(/\s+/g, '-').toUpperCase() || null;

  return {
    ok: true,
    fields: {
      code,
      title,
      type: type === 'Lote' ? 'Terreno' : type,
      purpose,
      status,
      price,
      rent_price: purpose === 'VENDA_E_ALUGUEL' ? rent : null,
      condo_fee: condo,
      neighborhood: cleanText(input.neighborhood, 100) || null,
      city: cleanText(input.city, 100) || null,
      bedrooms,
      bathrooms,
      parking_spots: parking,
      area_sqm: area ?? 0,
      description: cleanText(input.description, DESCRIPTION_MAX) || null,
      features,
      link_url: link,
    },
  };
}

export function propertyFromRow(row: Record<string, unknown>): RealEstateProperty {
  const num = (v: unknown) => (v == null ? null : Number(v));
  const purpose = PROPERTY_PURPOSES.includes(row.purpose as PropertyPurpose) ? (row.purpose as PropertyPurpose) : 'VENDA';
  const status = PROPERTY_STATUSES.includes(row.status as PropertyStatus) ? (row.status as PropertyStatus) : 'Disponível';
  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    title: String(row.title ?? ''),
    type: row.type === 'Lote' ? 'Terreno' : String(row.type ?? ''),
    purpose,
    status,
    price: Number(row.price ?? 0),
    rent_price: num(row.rent_price),
    condo_fee: num(row.condo_fee),
    neighborhood: (row.neighborhood as string) || null,
    city: (row.city as string) || null,
    bedrooms: Number(row.bedrooms ?? 0),
    bathrooms: Number(row.bathrooms ?? 0),
    parking_spots: Number(row.parking_spots ?? 0),
    area_sqm: Number(row.area_sqm ?? 0),
    description: (row.description as string) || null,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    link_url: (row.link_url as string) || null,
  };
}

/**
 * Máscara de dinheiro enquanto digita: "450000" → "450.000", "45050" → "45.050",
 * "450,5" → "450,5" (até 2 casas depois da vírgula). O servidor lê esse formato.
 */
export function formatMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, '');
  const commaAt = cleaned.indexOf(',');
  const intDigits = (commaAt >= 0 ? cleaned.slice(0, commaAt) : cleaned).replace(/^0+(?=\d)/, '');
  const intPart = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (commaAt < 0) return intPart;
  const decimals = cleaned.slice(commaAt + 1).replace(/,/g, '').slice(0, 2);
  return `${intPart || '0'},${decimals}`;
}

/** Valor salvo → texto do campo (450000 → "450.000"; 450.5 → "450,50"). */
export function moneyInputValue(value: number | null | undefined): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: value % 1 ? 2 : 0 });
}

/** "R$ 450.000" / "R$ 2.500/mês" / "R$ 450.000 ou R$ 2.500/mês" */
export function priceLabel(p: Pick<RealEstateProperty, 'purpose' | 'price' | 'rent_price'>): string {
  if (p.purpose === 'ALUGUEL') return `${formatBRL(p.price)}/mês`;
  if (p.purpose === 'VENDA_E_ALUGUEL' && p.rent_price) return `${formatBRL(p.price)} ou ${formatBRL(p.rent_price)}/mês`;
  return formatBRL(p.price);
}

/* ------------------------------------------------------------------ */
/* Busca para a atendente                                              */
/* ------------------------------------------------------------------ */

export function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type PropertySearch = {
  purpose?: 'VENDA' | 'ALUGUEL' | null;
  type?: string | null;
  location?: string | null;
  priceMax?: number | null;
  bedroomsMin?: number | null;
};

const TYPE_GROUPS: Record<string, string[]> = {
  casa: ['casa', 'casa em condominio', 'sobrado'],
  apartamento: ['apartamento', 'apto', 'ap', 'cobertura', 'flat', 'studio', 'kitnet'],
  terreno: ['terreno', 'lote'],
  comercial: ['comercial', 'sala', 'loja', 'ponto', 'galpao'],
  chacara: ['chacara', 'sitio', 'rural'],
};

function typeMatches(wanted: string, actual: string): boolean {
  const w = normalizeSearch(wanted);
  const a = normalizeSearch(actual);
  if (!w) return true;
  if (a === w || a.includes(w) || w.includes(a)) return true;
  return Object.values(TYPE_GROUPS).some((group) => group.some((g) => w.includes(g)) && group.some((g) => a.includes(g)));
}

function purposeMatches(wanted: PropertySearch['purpose'], actual: PropertyPurpose): boolean {
  if (!wanted) return true;
  return actual === wanted || actual === 'VENDA_E_ALUGUEL';
}

/** Valor que vale para o que o cliente quer (venda ou aluguel). */
export function priceFor(p: RealEstateProperty, purpose: PropertySearch['purpose']): number {
  if (purpose === 'ALUGUEL' && p.purpose === 'VENDA_E_ALUGUEL' && p.rent_price) return p.rent_price;
  return p.price;
}

function locationMatches(wanted: string, p: RealEstateProperty): boolean {
  const w = normalizeSearch(wanted);
  if (!w) return true;
  const hay = normalizeSearch(`${p.neighborhood || ''} ${p.city || ''} ${p.title}`);
  return w.split(/[,/]| ou /).some((part) => part.trim().length >= 3 && hay.includes(part.trim()));
}

export type SearchResult = { exact: RealEstateProperty[]; similar: RealEstateProperty[] };

/**
 * Imóveis disponíveis que combinam com o pedido. Sem nada exato, devolve
 * "parecidos" (até 15% acima do orçamento, outro bairro ou um quarto a menos)
 * para a IA oferecer como alternativa — sempre dizendo o que muda.
 */
export function searchProperties(all: RealEstateProperty[], s: PropertySearch, limit = 4): SearchResult {
  const offerable = all.filter((p) => OFFERABLE_STATUSES.includes(p.status) && purposeMatches(s.purpose, p.purpose));
  const typeOk = offerable.filter((p) => !s.type || typeMatches(s.type, p.type));

  const fits = (p: RealEstateProperty, slack: { price: number; bedrooms: number; anyLocation: boolean }) =>
    (!s.priceMax || priceFor(p, s.purpose) <= s.priceMax * slack.price) &&
    (!s.bedroomsMin || p.bedrooms >= s.bedroomsMin - slack.bedrooms) &&
    (slack.anyLocation || !s.location || locationMatches(s.location, p));

  const byPrice = (a: RealEstateProperty, b: RealEstateProperty) => priceFor(a, s.purpose) - priceFor(b, s.purpose);
  const exact = typeOk.filter((p) => fits(p, { price: 1, bedrooms: 0, anyLocation: false })).sort(byPrice);
  if (exact.length) return { exact: exact.slice(0, limit), similar: [] };

  const similar = typeOk
    .filter((p) => fits(p, { price: 1.15, bedrooms: 1, anyLocation: true }))
    .sort((a, b) => {
      // Mesmo bairro primeiro, depois o mais barato.
      const la = s.location && locationMatches(s.location, a) ? 0 : 1;
      const lb = s.location && locationMatches(s.location, b) ? 0 : 1;
      return la - lb || byPrice(a, b);
    });
  return { exact: [], similar: similar.slice(0, limit) };
}

/** Resumo do imóvel para a IA (o que ela pode dizer). */
export function propertyForAI(p: RealEstateProperty, opts: { showPrices: boolean; details?: boolean }) {
  return {
    codigo: p.code,
    titulo: p.title,
    tipo: p.type,
    finalidade: PURPOSE_LABELS[p.purpose],
    situacao: p.status,
    bairro: p.neighborhood,
    cidade: p.city,
    ...(opts.showPrices
      ? {
          valor: priceLabel(p),
          ...(p.condo_fee ? { condominio: `${formatBRL(p.condo_fee)}/mês` } : {}),
        }
      : { valor: 'informado pelo corretor' }),
    quartos: p.bedrooms || undefined,
    banheiros: p.bathrooms || undefined,
    vagas: p.parking_spots || undefined,
    area_m2: p.area_sqm || undefined,
    link_com_fotos: p.link_url || undefined,
    ...(opts.details
      ? { caracteristicas: p.features.length ? p.features : undefined, descricao: p.description || undefined }
      : { destaques: p.features.slice(0, 4) }),
  };
}

/* ------------------------------------------------------------------ */
/* Plano, funil e visitas                                              */
/* ------------------------------------------------------------------ */

/**
 * Starter: a IA abre a conversa (entende o que o cliente procura, mostra os
 * imóveis e passa para o corretor). Pro/Enterprise: conduz até a visita.
 */
export type RealEstateMode = 'PRIMEIRO_ATENDIMENTO' | 'COMPLETO';

export function realEstateModeForPlan(planTier: string | null | undefined): RealEstateMode {
  return normalizePlanTier(planTier) === 'STARTER' ? 'PRIMEIRO_ATENDIMENTO' : 'COMPLETO';
}

export const LEAD_STAGES = ['NOVO', 'EM_ATENDIMENTO', 'VISITA_AGENDADA', 'PROPOSTA', 'FECHADO', 'PERDIDO'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  NOVO: 'Novo',
  EM_ATENDIMENTO: 'Em atendimento',
  VISITA_AGENDADA: 'Visita marcada',
  PROPOSTA: 'Proposta',
  FECHADO: 'Fechado',
  PERDIDO: 'Sem interesse',
};

export function isLeadStage(value: unknown): value is LeadStage {
  return LEAD_STAGES.includes(value as LeadStage);
}

export const VISIT_STATUSES = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELLED'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  PENDING: 'Aguardando confirmação',
  CONFIRMED: 'Confirmada',
  DONE: 'Realizada',
  CANCELLED: 'Cancelada',
};

export function isVisitStatus(value: unknown): value is VisitStatus {
  return VISIT_STATUSES.includes(value as VisitStatus);
}

export type VisitRequest = {
  id: string;
  lead_id: string | null;
  property_id: string | null;
  property_label: string | null;
  customer_name: string;
  customer_phone: string;
  preferred_time: string;
  notes: string | null;
  status: VisitStatus;
  created_at: string;
};

/** Perfil de interesse num texto curto (lista de leads e prompt). */
export function interestSummary(lead: {
  interest_purpose?: string | null;
  interest_property_type?: string | null;
  region?: string | null;
  budget_max?: number | string | null;
  bedrooms_min?: number | null;
}): string {
  const parts: string[] = [];
  if (lead.interest_purpose === 'ALUGUEL') parts.push('Alugar');
  else if (lead.interest_purpose === 'VENDA') parts.push('Comprar');
  if (lead.interest_property_type) parts.push(lead.interest_property_type);
  if (lead.bedrooms_min) parts.push(`${lead.bedrooms_min}+ quartos`);
  if (lead.region) parts.push(lead.region);
  if (lead.budget_max) parts.push(`até ${formatBRL(Number(lead.budget_max))}`);
  return parts.join(' · ');
}
