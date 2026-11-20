import { NextRequest, NextResponse } from 'next/server';
import { requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { aiAvailable, generateAi, parseAiJson, type AiPart } from '@/lib/aiClient';
import {
  IMPORT_BASE64_MAX,
  IMPORT_MIME_TYPES,
  IMPORT_TEXT_MAX,
  MENU_IMPORT_PROMPT,
  parseImportedMenu,
} from '@/lib/menuImport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lê um cardápio e devolve os itens para revisão (não salva nada).
 * Body: { file: { mimeType, data (base64) } } (foto ou PDF) ou { text } (planilha CSV ou texto colado).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    if (!aiAvailable()) {
      return NextResponse.json({ success: false, error: 'A leitura automática ainda não foi liberada no servidor (falta a GEMINI_API_KEY).' }, { status: 503 });
    }
    const limit = await checkRateLimitDurable(`menu-import:${auth.session.tenantId}`, 30, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ success: false, error: 'Muitas leituras em pouco tempo. Tente de novo daqui a pouco.' }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as { text?: unknown; file?: { mimeType?: unknown; data?: unknown } };
    const parts: AiPart[] = [{ text: MENU_IMPORT_PROMPT }];
    if (body.file) {
      const mimeType = String(body.file.mimeType || '');
      const data = String(body.file.data || '');
      if (!(IMPORT_MIME_TYPES as readonly string[]).includes(mimeType)) {
        return NextResponse.json({ success: false, error: 'Envie foto (JPG, PNG, WEBP) ou PDF. Planilha: salve como CSV.' }, { status: 400 });
      }
      if (!data || data.length > IMPORT_BASE64_MAX || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) {
        return NextResponse.json({ success: false, error: 'Arquivo grande demais (até 3 MB). Tire a foto de novo ou divida o PDF.' }, { status: 400 });
      }
      parts.push({ inlineData: { mimeType, data } });
    } else {
      const text = String(body.text ?? '').trim();
      if (text.length < 5) return NextResponse.json({ success: false, error: 'Cole o cardápio ou envie um arquivo.' }, { status: 400 });
      parts.push({ text: `CARDÁPIO:\n${text.slice(0, IMPORT_TEXT_MAX)}` });
    }

    const result = await generateAi({ parts, json: true, maxOutputTokens: 12_000, temperature: 0.1, timeoutMs: 50_000, label: 'menu_import' });
    if (!result) {
      return NextResponse.json({ success: false, error: 'Não consegui ler esse cardápio agora. Tente de novo ou use uma foto mais nítida.' }, { status: 502 });
    }
    const items = parseImportedMenu(parseAiJson(result.text));
    if (!items.length) {
      return NextResponse.json({ success: false, error: 'Não encontrei itens com nome e preço. Confira se a foto está nítida e mostra o cardápio inteiro.' }, { status: 422 });
    }
    return NextResponse.json({ success: true, items });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.menu.import', error);
  }
}
