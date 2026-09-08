import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isCronRequest } from '@/lib/cronAuth';
import { isBillingMockEnabled, asaasUpdateSubscriptionValue } from '@/lib/asaasClient';
import { logger } from '@/lib/logger';
import { logOpsAlert } from '@/lib/opsAlert';

export const dynamic = 'force-dynamic';

/**
 * Cron diário: aplica na Asaas os reajustes agendados cuja data de aviso
 * prévio (30 dias) já passou — ver /api/interno/plans (quem agenda) e a
 * migration subscription_price_changes.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabaseAdmin
      .from('subscription_price_changes')
      .select('id, tenant_id, asaas_subscription_id, new_price_brl')
      .is('applied_at', null)
      .lte('effective_at', nowIso);

    if (error) throw error;

    let applied = 0;
    let failed = 0;

    for (const change of due || []) {
      try {
        if (!isBillingMockEnabled() && change.asaas_subscription_id) {
          await asaasUpdateSubscriptionValue(change.asaas_subscription_id, Number(change.new_price_brl));
        }

        await supabaseAdmin
          .from('subscriptions')
          .update({
            monthly_price_brl: change.new_price_brl,
            updated_at: nowIso,
          })
          .eq('tenant_id', change.tenant_id);

        await supabaseAdmin
          .from('subscription_price_changes')
          .update({ applied_at: nowIso })
          .eq('id', change.id);

        applied += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        logger.error('billing.apply_price_change_failed', { tenantId: change.tenant_id, message });
        await logOpsAlert({
          source: 'cron.apply-price-changes',
          message: `Falha ao aplicar reajuste agendado para tenant ${change.tenant_id}: ${message}`,
          tenantId: change.tenant_id,
        });
        // Não marca applied_at — tenta de novo no próximo run.
      }
    }

    return NextResponse.json({ success: true, checked: (due || []).length, applied, failed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao aplicar reajustes.';
    logger.error('billing.apply_price_changes_error', { message });
    await logOpsAlert({ source: 'cron.apply-price-changes', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
