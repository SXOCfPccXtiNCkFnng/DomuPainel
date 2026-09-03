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
    const percentOff = Number(body.percentOff);
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
    if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
      return NextResponse.json(
        { success: false, error: 'Desconto deve ser entre 1% e 100%.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('billing_coupons')
      .insert({
        code,
        percent_off: percentOff,
        amount_off_brl: null,
        active: true,
        max_redemptions: Number.isFinite(maxRedemptions) ? maxRedemptions : null,
        redemption_count: 0,
        expires_at: expiresAt,
        first_invoice_only: percentOff < 100,
        description: description || (percentOff >= 100 ? 'Cortesia / teste (100%)' : `Cupom ${percentOff}%`),
      })
      .select('*')
      .single();

    if (error) {
      const msg = error.message?.includes('duplicate')
        ? 'Já existe um cupom com este código.'
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
