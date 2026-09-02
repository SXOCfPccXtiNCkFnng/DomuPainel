/** Opções de segmentação do Starter (Contatos + Disparo) */
export const INTEREST_OPTIONS = [
  'Compra',
  'Aluguel',
  'Lançamento',
  'Investimento',
] as const;

export const REGION_OPTIONS = [
  'Zona Sul',
  'Zona Norte',
  'Zona Oeste',
  'Zona Leste',
  'Centro',
  'ABC',
  'Grande São Paulo',
  'Interior',
  'Litoral',
  'Outra',
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  'Apartamento',
  'Casa',
  'Cobertura',
  'Lote',
  'Comercial',
  'Studio',
] as const;

export const BUDGET_OPTIONS = [
  { label: 'Até R$ 300 mil', max: 300_000 },
  { label: 'Até R$ 500 mil', max: 500_000 },
  { label: 'Até R$ 800 mil', max: 800_000 },
  { label: 'Até R$ 1,2 mi', max: 1_200_000 },
  { label: 'Até R$ 2 mi', max: 2_000_000 },
  { label: 'Acima de R$ 2 mi', max: 99_000_000 },
] as const;

export const LEAD_STATUS_OPTIONS = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { value: 'QUALIFIED', label: 'Qualificado' },
  { value: 'VISITA_AGENDADA', label: 'Visita agendada' },
  { value: 'PROPOSTA', label: 'Proposta' },
  { value: 'FECHADO', label: 'Fechado' },
] as const;

export function formatBudget(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}
