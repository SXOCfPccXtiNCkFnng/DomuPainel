import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { activateTenantSubscription } from '@/lib/billing';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import type { TenantSegment } from '@/types';
import { isSalesAgentEnabled, isSalesTenant, salesTenantId, setSalesAgentEnabled } from '@/lib/salesAgent';

export const dynamic = 'force-dynamic';

/**
 * Modo teste da operação: mexe só na PRÓPRIA conta de quem está logado
 * (e-mail na allowlist do /interno). Fora da allowlist → 404.
 */
/** Estado da vendedora da Domu (para o Modo teste mostrar o liga/desliga). */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  const configured = Boolean(salesTenantId());
  return NextResponse.json({
    success: true,
    salesAgent: {
      configured,
      isThisAccount: isSalesTenant(gate.session.tenantId),
      enabled: configured ? await isSalesAgentEnabled() : false,
    },
  });
}

export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  const { tenantId } = gate.session;

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; segment?: unknown; enabled?: unknown };

    // Liga/desliga a vendedora da Domu (desligada, a conta de vendas atende como as outras do ramo dela).
    if (body.action === 'set_sales_agent') {
      if (!salesTenantId()) {
        return NextResponse.json({ success: false, error: 'Vendedora não configurada (DOMU_SALES_TENANT_ID).' }, { status: 400 });
      }
      const enabled = body.enabled === true;
      const result = await setSalesAgentEnabled(enabled, gate.email);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      logger.info('interno.test_mode.sales_agent', { enabled, by: gate.email });
      return NextResponse.json({ success: true, enabled });
    }

    if (body.action === 'set_segment') {
      const segment = String(body.segment || '') as TenantSegment;
      if (!(segment in SEGMENT_LABELS)) {
        return NextResponse.json({ success: false, error: 'Módulo inválido.' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ segment })
        .eq('id', tenantId);
      if (error) throw error;
      logger.info('interno.test_mode.segment', { tenantId, segment, by: gate.email });
      return NextResponse.json({ success: true, segment });
    }

    // Conta de teste que ainda não pagou: libera o painel sem passar pelo plano.
    if (body.action === 'unlock_panel') {
      await activateTenantSubscription({
        tenantId,
        planTier: 'PRO',
        monthlyPrice: 0,
        paymentMethod: 'PIX',
        couponCode: null,
        status: 'ACTIVE',
      });
      logger.info('interno.test_mode.unlock', { tenantId, by: gate.email });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error: unknown) {
    logger.error('interno.test_mode_failed', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Não foi possível aplicar.' }, { status: 500 });
  }
}
