import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireDispatcher } from '@/lib/requireAuth';
import { isProduction } from '@/lib/envSecrets';
import { logger } from '@/lib/logger';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'campaign-media';

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
    const safeName = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

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
