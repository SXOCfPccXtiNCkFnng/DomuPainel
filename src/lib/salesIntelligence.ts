/**
 * Inteligência de vendas (planos Pro e Enterprise). Regras puras, iguais
 * para todos os ramos: recebe "vendas" (pedido do delivery, atendimento da
 * agenda) com os itens de cada uma e devolve o que vende mais em cada dia da
 * semana, o que sai junto, o que cresceu ou caiu e o horário de pico de
 * cada item — já em frases prontas, com a ação sugerida.
 *
 * As Dicas da semana mandam estes mesmos números para a IA escrever as dicas.
 */
import { brtDateKey, brtMinutesOfDay, brtWeekday, WEEKDAY_LABELS } from '@/lib/scheduling';

export type SaleItem = { name: string; quantity: number; revenue: number };
export type Sale = { at: string; customerKey: string; items: SaleItem[] };

export type IntelligenceInsight = {
  kind: 'DESTAQUE_DIA' | 'COMBO' | 'CRESCEU' | 'CAIU' | 'HORARIO' | 'DIA_FRACO';
  title: string;
  text: string;
  /** Tela sugerida para agir. */
  href: string | null;
  action: string | null;
};

export type SalesIntelligence = {
  /** Unidade nas frases: "pedidos" ou "atendimentos". */
  unit: string;
  sales: number;
  /** Itens mais vendidos com a quantidade em cada dia (índice 0 = domingo). */
  weekdayMatrix: { item: string; total: number; byWeekday: number[] }[];
  /** O campeão de cada dia da semana. */
  topByWeekday: { weekday: number; label: string; item: string | null; quantity: number }[];
  /** Pares que saem juntos (mesmo pedido ou mesmo cliente). */
  pairs: { a: string; b: string; together: number; rate: number }[];
  /** Variação contra o período anterior de mesmo tamanho. */
  trends: { item: string; current: number; previous: number; changePct: number }[];
  insights: IntelligenceInsight[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function computeSalesIntelligence(input: {
  sales: Sale[];
  previous?: Sale[];
  /** 'pedido' = pares no mesmo pedido (delivery); 'cliente' = pares no histórico do cliente (agenda). */
  pairScope: 'pedido' | 'cliente';
  unit: string;
  campaignHref: string;
  catalogHref: string;
  /** Rótulo do catálogo nas ações ("cardápio", "serviços"). */
  catalogLabel: string;
}): SalesIntelligence {
  const { sales } = input;
  const totals = new Map<string, number>();
  const byDay = new Map<string, number[]>();
  const byHour = new Map<string, Map<number, number>>();
  const daySales = Array(7).fill(0) as number[];

  for (const sale of sales) {
    const at = new Date(sale.at);
    const day = brtWeekday(brtDateKey(at));
    const hour = Math.floor(brtMinutesOfDay(at) / 60);
    daySales[day]++;
    for (const it of sale.items) {
      if (!it.name) continue;
      totals.set(it.name, (totals.get(it.name) || 0) + it.quantity);
      const d = byDay.get(it.name) || Array(7).fill(0);
      d[day] += it.quantity;
      byDay.set(it.name, d);
      const h = byHour.get(it.name) || new Map<number, number>();
      h.set(hour, (h.get(hour) || 0) + it.quantity);
      byHour.set(it.name, h);
    }
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const weekdayMatrix = ranked.slice(0, 8).map(([item, total]) => ({
    item,
    total: round1(total),
    byWeekday: (byDay.get(item) || Array(7).fill(0)).map(round1),
  }));

  const topByWeekday = WEEKDAY_LABELS.map((label, weekday) => {
    let best: { item: string; q: number } | null = null;
    for (const [item, d] of byDay) if (d[weekday] > 0 && (!best || d[weekday] > best.q)) best = { item, q: d[weekday] };
    return { weekday, label, item: best?.item ?? null, quantity: round1(best?.q ?? 0) };
  });

  // Pares: no mesmo pedido (delivery) ou no histórico do cliente (agenda).
  const baskets: Set<string>[] = [];
  if (input.pairScope === 'pedido') {
    for (const s of sales) baskets.push(new Set(s.items.map((i) => i.name).filter(Boolean)));
  } else {
    const byCustomer = new Map<string, Set<string>>();
    for (const s of sales) {
      if (!s.customerKey) continue;
      const set = byCustomer.get(s.customerKey) || new Set<string>();
      for (const i of s.items) if (i.name) set.add(i.name);
      byCustomer.set(s.customerKey, set);
    }
    baskets.push(...byCustomer.values());
  }
  const single = new Map<string, number>();
  const pairCount = new Map<string, number>();
  for (const b of baskets) {
    const list = [...b].sort();
    for (const x of list) single.set(x, (single.get(x) || 0) + 1);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]}\u0000${list[j]}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
  }
  const pairs = [...pairCount.entries()]
    .filter(([, n]) => n >= 3)
    .map(([key, together]) => {
      const [x, y] = key.split('\u0000');
      // "Quem leva A leva B": A é o item de base (o mais vendido do par).
      const [a, b] = (single.get(x) || 0) >= (single.get(y) || 0) ? [x, y] : [y, x];
      return { a, b, together, rate: together / Math.max(1, single.get(a) || 1) };
    })
    .filter((p) => p.rate >= 0.2)
    .sort((p, q) => q.together - p.together || q.rate - p.rate)
    .slice(0, 5)
    .map((p) => ({ ...p, rate: Math.round(p.rate * 100) / 100 }));

  // Tendência contra o período anterior.
  const prevTotals = new Map<string, number>();
  for (const s of input.previous || []) for (const i of s.items) if (i.name) prevTotals.set(i.name, (prevTotals.get(i.name) || 0) + i.quantity);
  const trends = (input.previous?.length ? [...new Set([...totals.keys(), ...prevTotals.keys()])] : [])
    .map((item) => {
      const current = totals.get(item) || 0;
      const previous = prevTotals.get(item) || 0;
      return { item, current: round1(current), previous: round1(previous), changePct: previous ? Math.round(((current - previous) / previous) * 100) : 0 };
    })
    .filter((t) => t.previous >= 5 && Math.abs(t.changePct) >= 30)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5);

  // Frases.
  const insights: IntelligenceInsight[] = [];
  const openDays = daySales.filter((n) => n > 0).length || 1;

  // Item que vende muito acima do normal num dia (participação do dia ≥ 1,6× a média).
  const dayHighlights: { item: string; day: number; lift: number; q: number }[] = [];
  for (const [item, d] of byDay) {
    const total = d.reduce((s, v) => s + v, 0);
    if (total < 6) continue;
    for (let day = 0; day < 7; day++) {
      if (!daySales[day] || d[day] < 3) continue;
      const share = d[day] / total;
      const salesShare = daySales[day] / sales.length;
      const lift = share / Math.max(salesShare, 1 / openDays / 2);
      if (lift >= 1.6) dayHighlights.push({ item, day, lift, q: d[day] });
    }
  }
  dayHighlights.sort((a, b) => b.lift - a.lift || b.q - a.q);
  for (const h of dayHighlights.slice(0, 2)) {
    const label = WEEKDAY_LABELS[h.day];
    insights.push({
      kind: 'DESTAQUE_DIA',
      title: `${h.item} vende mais ${h.day === 0 || h.day === 6 ? 'no' : 'na'} ${lower(label)}`,
      text: `${h.item} sai ${round1(h.lift).toLocaleString('pt-BR')}x mais ${h.day === 0 || h.day === 6 ? 'no' : 'na'} ${lower(label)} do que nos outros dias (${round1(h.q).toLocaleString('pt-BR')} no período). Mande a campanha com ${h.item} ${h.day === 0 || h.day === 6 ? 'no' : 'na'} ${lower(label)} de manhã e deixe estoque reforçado.`,
      href: input.campaignHref,
      action: 'Criar campanha',
    });
  }

  for (const p of pairs.slice(0, 2)) {
    insights.push({
      kind: 'COMBO',
      title: `${p.a} + ${p.b}`,
      text:
        input.pairScope === 'pedido'
          ? `Em ${pct(p.rate)} dos ${input.unit} com ${p.a} também vem ${p.b} (${p.together} vezes). Monte um combo com um pequeno desconto: aumenta o ticket de quem não levava.`
          : `${pct(p.rate)} dos clientes de ${p.a} também fazem ${p.b} (${p.together} clientes). Ofereça ${p.b} para quem só faz ${p.a}: um pacote ou uma mensagem depois do atendimento.`,
      href: input.pairScope === 'pedido' ? input.catalogHref : input.campaignHref,
      action: input.pairScope === 'pedido' ? `Criar combo no ${input.catalogLabel}` : 'Criar campanha',
    });
  }

  const down = trends.find((t) => t.changePct < 0);
  if (down) {
    insights.push({
      kind: 'CAIU',
      title: `${down.item} caiu ${Math.abs(down.changePct)}%`,
      text: `Foram ${down.current.toLocaleString('pt-BR')} contra ${down.previous.toLocaleString('pt-BR')} no período anterior. Vale conferir preço, qualidade ou se faltou; uma promoção curta ajuda a recuperar.`,
      href: input.campaignHref,
      action: 'Criar promoção',
    });
  }
  const up = trends.find((t) => t.changePct > 0);
  if (up) {
    insights.push({
      kind: 'CRESCEU',
      title: `${up.item} subiu ${up.changePct}%`,
      text: `Foram ${up.current.toLocaleString('pt-BR')} contra ${up.previous.toLocaleString('pt-BR')} no período anterior. Aproveite a onda: destaque ${up.item} nas campanhas e na atendente.`,
      href: input.campaignHref,
      action: 'Destacar na campanha',
    });
  }

  // Dia mais fraco para o carro-chefe.
  const top = weekdayMatrix[0];
  if (top && sales.length >= 15) {
    const days = top.byWeekday.map((q, day) => ({ q, day })).filter((x) => daySales[x.day] > 0);
    if (days.length >= 3) {
      const weak = days.reduce((a, b) => (b.q < a.q ? b : a));
      const best = days.reduce((a, b) => (b.q > a.q ? b : a));
      if (best.q >= 4 && weak.q <= best.q / 3) {
        insights.push({
          kind: 'DIA_FRACO',
          title: `${WEEKDAY_LABELS[weak.day]} fraca para ${top.item}`,
          text: `${top.item} vende ${best.q.toLocaleString('pt-BR')} ${best.day === 0 || best.day === 6 ? 'no' : 'na'} ${lower(WEEKDAY_LABELS[best.day])} e só ${weak.q.toLocaleString('pt-BR')} ${weak.day === 0 || weak.day === 6 ? 'no' : 'na'} ${lower(WEEKDAY_LABELS[weak.day])}. Um preço especial só nesse dia ("${lower(WEEKDAY_LABELS[weak.day])} do ${top.item}") puxa movimento.`,
          href: input.campaignHref,
          action: 'Criar campanha',
        });
      }
    }
  }

  // Horário de pico do carro-chefe.
  if (top) {
    const hours = [...(byHour.get(top.item) || new Map()).entries()].sort((a, b) => b[1] - a[1]);
    if (hours[0] && hours[0][1] >= 5) {
      insights.push({
        kind: 'HORARIO',
        title: `Pico de ${top.item}: ${hours[0][0]}h`,
        text: `A maior parte de ${top.item} sai entre ${hours[0][0]}h e ${hours[0][0] + 1}h. Disparar a campanha uma hora antes pega o cliente decidindo.`,
        href: input.campaignHref,
        action: 'Agendar campanha',
      });
    }
  }

  return { unit: input.unit, sales: sales.length, weekdayMatrix, topByWeekday, pairs, trends, insights: insights.slice(0, 6) };
}

/** Em texto para a IA das Dicas da semana. */
export function intelligenceForAI(si: SalesIntelligence): string {
  if (!si.sales) return 'Inteligência de vendas: sem dados suficientes.';
  const day = (i: number) => WEEKDAY_LABELS[i].slice(0, 3);
  return [
    `Campeão de cada dia: ${si.topByWeekday.filter((d) => d.item).map((d) => `${d.label} ${d.item} (${d.quantity})`).join('; ') || 'sem dados'}`,
    `Mais vendidos por dia da semana: ${si.weekdayMatrix
      .slice(0, 5)
      .map((r) => `${r.item}: ${r.byWeekday.map((q, i) => `${day(i)} ${q}`).join(', ')}`)
      .join(' | ')}`,
    `Saem juntos: ${si.pairs.map((p) => `${p.a} + ${p.b} (${Math.round(p.rate * 100)}%)`).join('; ') || 'nada relevante'}`,
    `Variação contra o período anterior: ${si.trends.map((t) => `${t.item} ${t.changePct > 0 ? '+' : ''}${t.changePct}%`).join('; ') || 'estável'}`,
  ].join('\n');
}
