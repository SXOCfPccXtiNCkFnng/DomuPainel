import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  const { data, error } = await supabaseAdmin
    .from('billing_coupons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, coupons: data || [] });
}

export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  try {
    const body = await req.json();
    const code = String(body.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const isFreeDays = body.freeDays != null && body.freeDays !== '';
    const freeDays = Number(body.freeDays);
    const percentOff = Number(body.percentOff);
    // Desconto de entrada: dias grátis + X% nas N primeiras mensalidades pagas.
    const discountMonths = body.discountMonths == null || body.discountMonths === '' ? null : Number(body.discountMonths);
    const maxRedemptions =
      body.maxRedemptions == null || body.maxRedemptions === ''
        ? null
        : Number(body.maxRedemptions);
    const description = String(body.description || '').slice(0, 200);
    const expiresAt = body.expiresAt ? String(body.expiresAt) : null;

    if (code.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Código do cupom precisa ter pelo menos 4 caracteres.' },
        { status: 400 }
      );
    }
    if (isFreeDays && (!Number.isInteger(freeDays) || freeDays < 1 || freeDays > 365)) {
      return NextResponse.json(
        { success: false, error: 'Dias grátis deve ser entre 1 e 365.' },
        { status: 400 }
      );
    }
    if (discountMonths != null) {
      if (!isFreeDays || !Number.isInteger(discountMonths) || discountMonths < 1 || discountMonths > 12) {
        return NextResponse.json(
          { success: false, error: 'Desconto de entrada: informe os dias grátis e de 1 a 12 meses com desconto.' },
          { status: 400 }
        );
      }
      if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 99) {
        return NextResponse.json({ success: false, error: 'Desconto de entrada deve ser entre 1% e 99%.' }, { status: 400 });
      }
    }
    if (!isFreeDays && (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100)) {
      return NextResponse.json(
        { success: false, error: 'Desconto deve ser entre 1% e 100%.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('billing_coupons')
      .insert({
        code,
        percent_off: isFreeDays && discountMonths == null ? null : percentOff,
        amount_off_brl: null,
        ...(isFreeDays ? { free_days: freeDays } : {}),
        ...(discountMonths != null ? { discount_months: discountMonths } : {}),
        active: true,
        max_redemptions: Number.isFinite(maxRedemptions) ? maxRedemptions : null,
        redemption_count: 0,
        expires_at: expiresAt,
        first_invoice_only: isFreeDays ? false : percentOff < 100,
        description:
          description ||
          (isFreeDays && discountMonths != null
            ? `${freeDays} dias grátis + ${percentOff}% nos ${discountMonths === 1 ? 'primeiro mês' : `${discountMonths} primeiros meses`}`
            : isFreeDays
            ? `${freeDays} dias grátis`
            : percentOff >= 100
              ? 'Cortesia / teste (100%)'
              : `Cupom ${percentOff}%`),
      })
      .select('*')
      .single();

    if (error) {
      const msg = error.message?.includes('duplicate')
        ? 'Já existe um cupom com este código.'
        : discountMonths != null && error.message?.includes('discount_months')
          ? 'Rode a migration 20261124_intro_discount.sql no Supabase para criar o desconto de entrada.'
          : isFreeDays && error.message?.includes('free_days')
          ? 'Rode a migration 20261021_coupon_free_days.sql no Supabase para criar cupom de dias.'
          : 'Não foi possível criar o cupom (rode a migration de cupons no Supabase).';
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true, coupon: data });
  } catch {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  const body = await req.json();
  const code = String(body.code || '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ success: false, error: 'Informe o cupom.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('billing_coupons')
    .update({
      active: Boolean(body.active),
      updated_at: new Date().toISOString(),
    })
    .eq('code', code);

  if (error) {
    return NextResponse.json({ success: false, error: 'Não foi possível atualizar.' }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
