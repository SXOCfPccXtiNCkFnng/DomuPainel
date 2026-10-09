import { supabaseAdmin } from '@/lib/supabaseServer';

export function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfUtcMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Disparos de campanha usados desde `sinceIso` (limite do plano). Follow-up
 * automático fica de fora de propósito: é mensagem individual, não disparo
 * em massa.
 */
export async function countDispatchesSince(tenantId: string, sinceIso: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('sent_count')
    .eq('tenant_id', tenantId)
    .gte('created_at', sinceIso);

  return (data || []).reduce(
    (sum, row: { sent_count?: number | null }) => sum + Number(row.sent_count || 0),
    0
  );
}
