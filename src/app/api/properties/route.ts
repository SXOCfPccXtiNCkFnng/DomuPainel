import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, properties: data || [] });
  } catch (error: any) {
    console.error('[Properties GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const { property } = body;

    if (!property?.title || !property?.type || property?.price == null) {
      return NextResponse.json(
        { success: false, error: 'Título, tipo e preço são obrigatórios.' },
        { status: 400 }
      );
    }

    const code =
      property.code ||
      `IMV-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabaseAdmin
      .from('properties')
      .insert({
        tenant_id: tenantId,
        code,
        title: property.title,
        type: property.type,
        neighborhood: property.neighborhood || null,
        city: property.city || null,
        price: Number(property.price),
        bedrooms: property.bedrooms ?? 0,
        bathrooms: property.bathrooms ?? 0,
        area_sqm: property.area_sqm ?? 0,
        image_url: property.image_url || null,
        status: property.status || 'Disponível',
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, property: data });
  } catch (error: any) {
    console.error('[Properties POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
