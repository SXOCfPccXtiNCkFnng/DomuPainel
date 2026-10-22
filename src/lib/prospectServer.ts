/** Busca de estabelecimentos no Google Places e leitura do site para achar o Instagram. */
import { lookup } from 'node:dns/promises';
import {
  extractInstagramFromHtml,
  instagramFromUrl,
  isPrivateAddress,
  type PlacesPlace,
} from '@/lib/prospectRules';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',');

/** Cada página = 1 cobrança no Google; 3 páginas = até 60 lugares. */
const MAX_PAGES = 3;

/** Chave própria ou, na falta dela, a mesma do Gemini (precisa da Places API (New) liberada no projeto). */
export function placesApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || null;
}

export class PlacesError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function searchPlaces(textQuery: string): Promise<{ places: PlacesPlace[]; pages: number }> {
  const key = placesApiKey();
  if (!key) throw new PlacesError('GOOGLE_PLACES_API_KEY não configurada.', 503);

  const places: PlacesPlace[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const res = await fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20, pageToken }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    pages++;
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body?.error?.message || `Google Places respondeu ${res.status}`;
      console.error('[prospect] places error', res.status, msg);
      throw new PlacesError(msg, res.status === 429 ? 429 : 502);
    }
    const json = (await res.json()) as { places?: PlacesPlace[]; nextPageToken?: string };
    places.push(...(json.places || []));
    pageToken = json.nextPageToken;
  } while (pageToken && pages < MAX_PAGES);

  return { places, pages };
}

const SITE_TIMEOUT_MS = 5_000;
const SITE_MAX_BYTES = 600_000;
const MAX_REDIRECTS = 3;

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocolo');
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('porta');
  if (url.username || url.password) throw new Error('credenciais');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('host');
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('ip privado');
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < SITE_MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Abre o site do estabelecimento e procura o link do Instagram. Qualquer falha → null. */
export async function findInstagramOnSite(website: string): Promise<string | null> {
  const direct = instagramFromUrl(website);
  if (direct) return direct;
  try {
    let url = new URL(website);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(url);
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DomuBot/1.0)', Accept: 'text/html' },
        cache: 'no-store',
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        url = new URL(location, url);
        const fromRedirect = instagramFromUrl(url.toString());
        if (fromRedirect) return fromRedirect;
        continue;
      }
      if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null;
      return extractInstagramFromHtml(await readLimited(res));
    }
  } catch {
    return null;
  }
  return null;
}

/** Roda `fn` sobre os itens com no máximo `limit` ao mesmo tempo. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}
