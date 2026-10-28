/**
 * Imagens dos modelos com imagem no topo.
 * - Exemplo para a Meta aprovar: a imagem que o cliente enviou (só do nosso
 *   armazenamento — o servidor nunca baixa um endereço qualquer) ou, nos
 *   modelos criados sozinhos, uma imagem neutra gerada aqui.
 * - No disparo, vai a imagem escolhida na campanha (a Meta baixa o link).
 */
import zlib from 'zlib';
import { TEMPLATE_IMAGE_MAX_BYTES, TEMPLATE_IMAGE_TYPES } from '@/lib/metaClient';

const MEDIA_BUCKET = 'campaign-media';

/** Link público de arquivo enviado pelo painel (bucket campaign-media do Supabase). */
export function isOwnMediaUrl(url: string): boolean {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/${MEDIA_BUCKET}/`);
}

/** Imagem para o disparo: https, até 1000 caracteres (a Meta baixa o link). */
export function isValidCampaignImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 1000) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** Baixa a imagem enviada pelo painel para mandar como exemplo à Meta. */
export async function fetchOwnMediaImage(url: string): Promise<{ ok: true; data: Buffer; mimeType: string } | { ok: false; error: string }> {
  if (!isOwnMediaUrl(url)) return { ok: false, error: 'Envie a imagem pelo botão de upload (JPG ou PNG).' };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, error: 'Não foi possível ler a imagem enviada.' };
    const mimeType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!TEMPLATE_IMAGE_TYPES.includes(mimeType)) return { ok: false, error: 'A imagem do modelo precisa ser JPG ou PNG.' };
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > TEMPLATE_IMAGE_MAX_BYTES) return { ok: false, error: 'A imagem do modelo pode ter no máximo 5 MB.' };
    return { ok: true, data, mimeType };
  } catch {
    return { ok: false, error: 'Não foi possível ler a imagem enviada.' };
  }
}

/* ------------------------------------------------------------------ */
/* Imagem de exemplo gerada (PNG 1.91:1, sem depender de arquivo)      */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * PNG 800x418 com degradê na cor do ramo e um "cartão" claro no centro —
 * só exemplo para a análise da Meta; o cliente manda a foto de verdade em
 * cada campanha.
 */
export function generateSampleImage(rgb: [number, number, number] = [30, 90, 246]): Buffer {
  const width = 800;
  const height = 418;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filtro "nenhum"
    for (let x = 0; x < width; x++) {
      const inCard = x > 200 && x < 600 && y > 110 && y < 308;
      const shade = 0.75 + 0.25 * (x / width);
      const i = row + 1 + x * 3;
      raw[i] = inCard ? 248 : Math.round(rgb[0] * shade);
      raw[i + 1] = inCard ? 250 : Math.round(rgb[1] * shade);
      raw[i + 2] = inCard ? 252 : Math.round(rgb[2] * shade);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits por canal
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
