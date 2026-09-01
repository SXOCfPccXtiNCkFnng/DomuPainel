import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabaseServer';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — limite Meta
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tenantId = (formData.get('tenantId') as string) || 'default';

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

    // Tenta Supabase Storage (produção)
    try {
      const { error: uploadError } = await supabaseAdmin.storage
        .from('campaign-media')
        .upload(safeName, buffer, { contentType: file.type, upsert: false });

      if (!uploadError) {
        const { data: publicData } = supabaseAdmin.storage
          .from('campaign-media')
          .getPublicUrl(safeName);

        if (publicData?.publicUrl) {
          return NextResponse.json({
            success: true,
            url: publicData.publicUrl,
            source: 'supabase',
          });
        }
      }
    } catch {
      // fallback local abaixo
    }

    // Fallback local (desenvolvimento)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'campaigns', tenantId);
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    const origin = req.nextUrl.origin;
    const publicUrl = `${origin}/uploads/campaigns/${tenantId}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      source: 'local',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar imagem.';
    console.error('[Media Upload Error]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
