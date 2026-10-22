import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  SEARCH_REUSE_DAYS,
  buildSearchQuery,
  placeToProspect,
  prospectKind,
  type ProspectRow,
} from '@/lib/prospectRules';
import { PlacesError, findInstagramOnSite, mapLimit, searchPlaces } from '@/lib/prospectServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CITY_RE = /^[\p{L}\p{M}' .-]{2,60}$/u;
const MAX_SITE_CHECKS = 40;

/**
 * Busca um tipo de estabelecimento em uma cidade no Google e salva os leads.
 * Se a mesma busca foi feita há menos de SEARCH_REUSE_DAYS dias, reaproveita
 * (não gasta cota), a não ser que venha `force`.
 */
export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const kind = prospectKind(String(body?.kind || ''));
  const city = String(body?.city || '').trim();
  if (!kind) return NextResponse.json({ success: false, error: 'Tipo de estabelecimento inválido.' }, { status: 400 });
  if (!CITY_RE.test(city)) return NextResponse.json({ success: false, error: 'Cidade inválida.' }, { status: 400 });

  const { data: previous, error: prevError } = await supabaseAdmin
    .from('prospect_searches')
    .select('result_count, searched_at')
    .eq('kind', kind.id)
    .eq('city', city)
    .maybeSingle();
  if (prevError?.code === '42P01') {
    return NextResponse.json({ success: false, error: 'Rode a migration 20261021_prospects.sql no Supabase.' }, { status: 503 });
  }
  const fresh =
    previous?.searched_at && Date.now() - new Date(previous.searched_at).getTime() < SEARCH_REUSE_DAYS * 24 * 60 * 60 * 1000;
  if (fresh && !body?.force) {
    return NextResponse.json({ success: true, reused: true, found: previous.result_count, inserted: 0 });
  }

  let places;
  try {
    places = (await searchPlaces(buildSearchQuery(kind, city))).places;
  } catch (error) {
    const status = error instanceof PlacesError ? error.status : 502;
    const keyNotAccepted = error instanceof Error && /API keys are not supported/i.test(error.message);
    const message = keyNotAccepted
      ? 'Essa chave (criada no AI Studio) não funciona no Maps. Crie uma chave comum no Google Cloud e coloque em GOOGLE_PLACES_API_KEY na Vercel.'
      : status === 503
        ? 'Configure a GOOGLE_PLACES_API_KEY na Vercel.'
        : status === 429
          ? 'Limite do Google atingido. Tente de novo em alguns minutos.'
          : 'O Google recusou a busca. No projeto da chave, ative a Places API (New), libere ela nas restrições da chave e confira se o faturamento está ativo.';
    const detail = error instanceof PlacesError ? error.message : String(error);
    return NextResponse.json({ success: false, error: message, detail }, { status });
  }

  const byPlace = new Map<string, ProspectRow>();
  for (const p of places) {
    if (p.businessStatus === 'CLOSED_PERMANENTLY') continue;
    const row = placeToProspect(p, kind, city);
    if (row) byPlace.set(row.place_id, row);
  }
  const rows = [...byPlace.values()];

  const { data: existing } = rows.length
    ? await supabaseAdmin
        .from('prospects')
        .select('place_id, kind, module, instagram, instagram_checked_at')
        .in('place_id', rows.map((r) => r.place_id))
    : { data: [] };
  const existingMap = new Map((existing || []).map((e) => [e.place_id, e]));

  const now = new Date().toISOString();
  const toCheck = rows
    .filter((r) => !r.instagram && r.website && !existingMap.get(r.place_id)?.instagram_checked_at)
    .slice(0, MAX_SITE_CHECKS);
  const found = await mapLimit(toCheck, 6, (r) => findInstagramOnSite(r.website!));
  const checked = new Map(toCheck.map((r, i) => [r.place_id, found[i]]));

  const payload = rows.map((r) => {
    const prev = existingMap.get(r.place_id);
    const wasChecked = checked.has(r.place_id) || Boolean(r.instagram);
    return {
      ...r,
      // Mesmo lugar achado por outro tipo de busca: mantém a classificação original.
      kind: prev?.kind || r.kind,
      module: prev?.module || r.module,
      instagram: r.instagram || checked.get(r.place_id) || prev?.instagram || null,
      instagram_checked_at: wasChecked ? now : prev?.instagram_checked_at || null,
      last_seen_at: now,
      updated_at: now,
    };
  });

  if (payload.length) {
    const { error } = await supabaseAdmin.from('prospects').upsert(payload, { onConflict: 'place_id' });
    if (error) {
      console.error('[prospects] upsert', error);
      return NextResponse.json({ success: false, error: 'Não foi possível salvar os leads.' }, { status: 500 });
    }
  }
  await supabaseAdmin
    .from('prospect_searches')
    .upsert({ kind: kind.id, city, result_count: payload.length, searched_at: now }, { onConflict: 'kind,city' });

  return NextResponse.json({
    success: true,
    reused: false,
    found: payload.length,
    inserted: payload.filter((p) => !existingMap.has(p.place_id)).length,
  });
}
