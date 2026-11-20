/**
 * Inteligência de demanda do imobiliário (planos Pro e Enterprise). O que os
 * clientes procuram (tipo, região, faixa de valor), em que dia e horário
 * eles chegam e o que falta no catálogo. Regras puras.
 */
import { brtDateKey, brtMinutesOfDay, brtWeekday, WEEKDAY_LABELS } from '@/lib/scheduling';
import { formatBRL, normalizeSearch, searchProperties, type RealEstateProperty } from '@/lib/realEstate';
import type { IntelligenceInsight } from '@/lib/salesIntelligence';

export type DemandLead = {
  interest_purpose: string | null;
  interest_property_type: string | null;
  region: string | null;
  budget_max: number | string | null;
  status: string | null;
  created_at: string;
};

export type RealEstateDemand = {
  leads: number;
  withProfile: number;
  types: { label: string; count: number; converted: number }[];
  regions: { label: string; count: number }[];
  budgets: { label: string; count: number }[];
  weekdays: { label: string; count: number }[];
  peakHour: number | null;
  gaps: { type: string; region: string; purpose: string | null; leads: number; budget: number | null }[];
  insights: IntelligenceInsight[];
};

const SALE_BANDS = [
  { max: 300_000, label: 'Até R$ 300 mil' },
  { max: 500_000, label: 'R$ 300 a 500 mil' },
  { max: 1_000_000, label: 'R$ 500 mil a 1 mi' },
  { max: Infinity, label: 'Acima de R$ 1 mi' },
];
const RENT_BANDS = [
  { max: 1_500, label: 'Aluguel até R$ 1.500' },
  { max: 3_000, label: 'Aluguel R$ 1.500 a 3.000' },
  { max: Infinity, label: 'Aluguel acima de R$ 3.000' },
];

const title = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const CONVERTED = ['VISITA_AGENDADA', 'PROPOSTA', 'FECHADO'];

export function computeRealEstateDemand(leads: DemandLead[], properties: RealEstateProperty[]): RealEstateDemand {
  const count = <T,>(items: T[], key: (t: T) => string | null) => {
    const map = new Map<string, { label: string; count: number }>();
    for (const it of items) {
      const raw = key(it);
      if (!raw) continue;
      const k = normalizeSearch(raw);
      const cur = map.get(k) || { label: title(raw), count: 0 };
      cur.count++;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  };

  const withProfile = leads.filter((l) => l.interest_property_type || l.region || l.budget_max);
  const types = count(withProfile, (l) => l.interest_property_type)
    .slice(0, 6)
    .map((t) => ({
      ...t,
      converted: withProfile.filter((l) => normalizeSearch(l.interest_property_type) === normalizeSearch(t.label) && CONVERTED.includes(String(l.status))).length,
    }));
  const regions = count(withProfile, (l) => l.region).slice(0, 8);
  const budgets = count(withProfile, (l) => {
    const v = Number(l.budget_max);
    if (!v) return null;
    const bands = l.interest_purpose === 'ALUGUEL' ? RENT_BANDS : SALE_BANDS;
    return bands.find((b) => v <= b.max)!.label;
  });

  const days = WEEKDAY_LABELS.map((label) => ({ label, count: 0 }));
  const hours = new Map<number, number>();
  for (const l of leads) {
    const at = new Date(l.created_at);
    days[brtWeekday(brtDateKey(at))].count++;
    const h = Math.floor(brtMinutesOfDay(at) / 60);
    hours.set(h, (hours.get(h) || 0) + 1);
  }
  const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];

  // Lacunas: tipo + região que vários clientes pedem e o catálogo não tem.
  const groups = new Map<string, { type: string; region: string; purpose: string | null; leads: number; budgets: number[] }>();
  for (const l of withProfile) {
    if (!l.interest_property_type || !l.region) continue;
    const key = `${normalizeSearch(l.interest_property_type)}|${normalizeSearch(l.region)}|${l.interest_purpose || ''}`;
    const g = groups.get(key) || { type: title(l.interest_property_type), region: title(l.region), purpose: l.interest_purpose, leads: 0, budgets: [] };
    g.leads++;
    if (Number(l.budget_max)) g.budgets.push(Number(l.budget_max));
    groups.set(key, g);
  }
  const gaps = [...groups.values()]
    .filter((g) => g.leads >= 3)
    .filter((g) => {
      const purpose = g.purpose === 'ALUGUEL' || g.purpose === 'VENDA' ? g.purpose : null;
      return searchProperties(properties, { purpose, type: g.type, location: g.region }).exact.length === 0;
    })
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5)
    .map((g) => ({
      type: g.type,
      region: g.region,
      purpose: g.purpose,
      leads: g.leads,
      budget: g.budgets.length ? g.budgets.sort((a, b) => a - b)[Math.floor(g.budgets.length / 2)] : null,
    }));

  const insights: IntelligenceInsight[] = [];
  for (const g of gaps.slice(0, 2)) {
    insights.push({
      kind: 'DESTAQUE_DIA',
      title: `Falta ${g.type.toLowerCase()} em ${g.region}`,
      text: `${g.leads} clientes procuram ${g.type.toLowerCase()}${g.purpose === 'ALUGUEL' ? ' para alugar' : g.purpose === 'VENDA' ? ' para comprar' : ''} em ${g.region}${g.budget ? ` (valor típico ${formatBRL(g.budget)})` : ''} e o catálogo não tem nenhum disponível. Vale captar imóveis assim: os compradores já estão na sua base.`,
      href: '/imoveis',
      action: 'Cadastrar imóvel',
    });
  }
  const bestDay = [...days].sort((a, b) => b.count - a.count)[0];
  if (bestDay && bestDay.count >= 5) {
    insights.push({
      kind: 'HORARIO',
      title: `Mais clientes chegam ${bestDay.label === 'Domingo' || bestDay.label === 'Sábado' ? 'no' : 'na'} ${bestDay.label.toLowerCase()}`,
      text: `${bestDay.count} dos ${leads.length} contatos chegaram ${bestDay.label === 'Domingo' || bestDay.label === 'Sábado' ? 'no' : 'na'} ${bestDay.label.toLowerCase()}${peak ? `, com pico às ${peak[0]}h` : ''}. Mande os lançamentos nesse dia, uma hora antes do pico, e deixe um corretor de plantão.`,
      href: '/disparos',
      action: 'Agendar campanha',
    });
  }
  const topType = types[0];
  if (topType && topType.count >= 5) {
    const rate = Math.round((topType.converted / topType.count) * 100);
    insights.push({
      kind: 'CRESCEU',
      title: `${topType.label} é o mais procurado`,
      text: `${topType.count} clientes querem ${topType.label.toLowerCase()} e ${rate}% deles já chegaram a visita ou proposta. ${rate < 15 ? 'Poucos avançam: confira se os valores do catálogo batem com o que pedem.' : 'Destaque esse tipo nas campanhas.'}`,
      href: rate < 15 ? '/imoveis' : '/disparos',
      action: rate < 15 ? 'Ver catálogo' : 'Criar campanha',
    });
  }
  const topBudget = budgets[0];
  if (topBudget && topBudget.count >= 5) {
    insights.push({
      kind: 'COMBO',
      title: `Faixa mais pedida: ${topBudget.label}`,
      text: `${topBudget.count} clientes estão nessa faixa de valor. Separe os imóveis dessa faixa numa campanha para esse público.`,
      href: '/disparos',
      action: 'Criar campanha',
    });
  }

  return {
    leads: leads.length,
    withProfile: withProfile.length,
    types,
    regions,
    budgets,
    weekdays: [1, 2, 3, 4, 5, 6, 0].map((i) => days[i]),
    peakHour: peak ? peak[0] : null,
    gaps,
    insights,
  };
}
