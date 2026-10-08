/**
 * Filtros `.in('id', [...])` do Supabase vão na URL da requisição. Com
 * centenas de UUIDs a URL passa do limite do servidor e a chamada falha —
 * e cada consulta devolve no máximo 1000 linhas. Quebre listas grandes nisto.
 */
export const IN_FILTER_CHUNK = 150;

export function chunk<T>(items: T[], size = IN_FILTER_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
