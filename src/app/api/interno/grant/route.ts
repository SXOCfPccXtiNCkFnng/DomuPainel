import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { activateTenantSubscription } from '@/lib/billing';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/** Libera 30 dias de acesso sem cobrança (cortesia). */
export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  try {
    const body = await req.json();
    const tenantId = String(body.tenantId || '');
    const planTier = String(body.planTier || 'STARTER');
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Informe a empresa.' }, { status: 400 });
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle();
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Empresa não encontrada.' }, { status: 404 });
    }

    await activateTenantSubscription({
      tenantId,
      planTier,
      monthlyPrice: 0,
      paymentMethod: 'PIX',
      couponCode: null,
      status: 'ACTIVE',
    });

    return NextResponse.json({
      success: true,
      message: `Acesso liberado por 30 dias para ${tenant.name}.`,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }
}
