import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { normalizePlanTier } from '@/lib/planLimits';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Atualiza o preço de um ou mais planos (tabela plan_prices).
 * Só afeta cadastros novos e trocas/reativações de plano a partir de agora —
 * assinaturas Asaas já ativas mantêm o valor contratado (Termos de Uso, seção 5).
 */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  try {
    const body = await req.json();
    const updates = body.prices as Record<string, unknown> | undefined;
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Informe os preços a atualizar.' },
        { status: 400 }
      );
    }

    const rows: { plan_tier: string; price_brl: number; updated_at: string }[] = [];
    for (const [tierRaw, valueRaw] of Object.entries(updates)) {
      const tier = normalizePlanTier(tierRaw);
      const value = Number(valueRaw);
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json(
          { success: false, error: `Preço inválido para o plano ${tier}.` },
          { status: 400 }
        );
      }
      rows.push({ plan_tier: tier, price_brl: value, updated_at: new Date().toISOString() });
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum plano informado.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('plan_prices').upsert(rows, { onConflict: 'plan_tier' });
    if (error) throw error;

    logger.info('interno.plan_prices_updated', {
      byEmail: gate.email,
      prices: Object.fromEntries(rows.map((r) => [r.plan_tier, r.price_brl])),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('interno.plan_prices_update_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Não foi possível salvar os preços.' },
      { status: 500 }
    );
  }
}
