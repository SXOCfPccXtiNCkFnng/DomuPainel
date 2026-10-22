import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isProspectStatus, phoneKey } from '@/lib/prospectRules';
import { placesApiKey } from '@/lib/prospectServer';

export const dynamic = 'force-dynamic';

const MISSING_TABLE = '42P01';

/** Todos os leads de prospecção + buscas já feitas. Marca quem já é cliente pelo telefone. */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  const [prospectsRes, searchesRes, tenantsRes, usersRes] = await Promise.all([
    supabaseAdmin
      .from('prospects')
      .select(
        'id, name, kind, module, city, address, phone, phone_intl, is_mobile, website, instagram, maps_url, rating, rating_count, business_status, status, notes, contacted_at, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(5000),
    supabaseAdmin.from('prospect_searches').select('kind, city, result_count, searched_at'),
    supabaseAdmin.from('tenants').select('whatsapp_number'),
    supabaseAdmin.from('users').select('phone').limit(10000),
  ]);

  if (prospectsRes.error?.code === MISSING_TABLE || searchesRes.error?.code === MISSING_TABLE) {
    return NextResponse.json({ success: true, needsMigration: true, configured: Boolean(placesApiKey()), prospects: [], searches: [] });
  }
  if (prospectsRes.error || searchesRes.error) {
    console.error('[prospects] list', prospectsRes.error || searchesRes.error);
    return NextResponse.json({ success: false, error: 'Não foi possível carregar os leads.' }, { status: 500 });
  }

  const clientKeys = new Set<string>();
  for (const t of tenantsRes.data || []) {
    const k = phoneKey(t.whatsapp_number);
    if (k) clientKeys.add(k);
  }
  for (const u of usersRes.data || []) {
    const k = phoneKey(u.phone);
    if (k) clientKeys.add(k);
  }

  return NextResponse.json({
    success: true,
    configured: Boolean(placesApiKey()),
    prospects: (prospectsRes.data || []).map((p) => {
      const k = phoneKey(p.phone_intl || p.phone);
      return { ...p, rating: p.rating == null ? null : Number(p.rating), isClient: Boolean(k && clientKeys.has(k)) };
    }),
    searches: searchesRes.data || [],
  });
}

/** Atualiza status e/ou anotação de um ou vários leads. */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((id) => typeof id === 'string' && id.length <= 40)) {
    return NextResponse.json({ success: false, error: 'Selecione pelo menos um lead.' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!isProspectStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }
    update.status = body.status;
    if (body.status !== 'NEW' && body.markContacted) update.contacted_at = new Date().toISOString();
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 2000) {
      return NextResponse.json({ success: false, error: 'Anotação muito longa.' }, { status: 400 });
    }
    update.notes = body.notes.trim() || null;
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ success: false, error: 'Nada para atualizar.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('prospects').update(update).in('id', ids);
  if (error) {
    console.error('[prospects] update', error);
    return NextResponse.json({ success: false, error: 'Não foi possível salvar.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
