import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireDispatcher } from '@/lib/requireAuth';
import { isProduction } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'campaign-media';

/** Tipo real pelos primeiros bytes (magic numbers). */
function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Formato inválido. Use JPG, PNG ou WebP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Arquivo muito grande. Máximo 5 MB (limite da Meta).' },
        { status: 400 }
      );
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    // Nome imprevisível: o link é público (o WhatsApp precisa baixar), então não
    // pode dar para "chutar" o arquivo de outro cliente.
    const safeName = `${tenantId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // O tipo informado pelo navegador é só uma declaração: confere a assinatura
    // real do arquivo para o bucket público não servir HTML/script "disfarçado".
    if (detectImageType(buffer) !== file.type) {
      return NextResponse.json(
        { success: false, error: 'O arquivo não é uma imagem JPG, PNG ou WebP válida.' },
        { status: 400 }
      );
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(safeName, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      logger.error('media.upload_failed', { message: uploadError.message, tenantId });
      return NextResponse.json(
        {
          success: false,
          error: isProduction()
            ? 'Falha no upload para o Storage. Verifique o bucket campaign-media no Supabase.'
            : `Storage falhou: ${uploadError.message}. Rode a migration 20260328_storage_campaign_media.sql.`,
        },
        { status: 502 }
      );
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(safeName);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json(
        { success: false, error: 'Upload ok, mas URL pública indisponível.' },
        { status: 500 }
      );
    }

    await supabaseAdmin.from('media_storage').insert({
      tenant_id: tenantId,
      file_name: file.name || safeName,
      file_path: safeName,
      file_size: file.size,
      mime_type: file.type,
      public_url: publicUrl,
    });

    logger.info('media.uploaded', { tenantId, path: safeName, size: file.size });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      source: 'supabase',
      path: safeName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar imagem.';
    logger.error('media.upload_exception', { message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
