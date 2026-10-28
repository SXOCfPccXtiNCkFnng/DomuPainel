/**
 * Áudios do cliente para a atendente: o webhook guarda o id da mídia na Meta
 * (chat_messages.media_url); antes de responder, a atendente baixa o áudio e o
 * Gemini transcreve. A transcrição substitui o "[audio]" da mensagem — a IA
 * responde ao que foi falado e o monitor mostra o texto.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { META_GRAPH_API_VERSION, metaFetch } from '@/lib/metaClient';
import { addUsage, type TokenUsage } from '@/lib/assistantUsage';

export const META_MEDIA_PREFIX = 'meta-media:';
/** Marca do texto transcrito (a IA e o painel reconhecem). */
export const TRANSCRIBED_PREFIX = '🎤 Áudio: ';
/** Áudio maior que isso (≈ vários minutos) não é transcrito: a IA pede para escrever. */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** Por execução, no máximo os últimos áudios ainda sem transcrição. */
const MAX_AUDIOS_PER_RUN = 3;
const TRANSCRIBE_TIMEOUT_MS = 15_000;

export function parseMetaMedia(mediaUrl: string | null | undefined): { id: string; mimeType: string } | null {
  if (!mediaUrl || !mediaUrl.startsWith(META_MEDIA_PREFIX)) return null;
  const [id, mimeType] = mediaUrl.slice(META_MEDIA_PREFIX.length).split('|');
  if (!id || !/^[0-9]+$/.test(id)) return null;
  // "audio/ogg; codecs=opus" → "audio/ogg" (o Gemini quer o tipo simples).
  return { id, mimeType: (mimeType || 'audio/ogg').split(';')[0].trim() || 'audio/ogg' };
}

export function transcribedBody(text: string): string {
  return `${TRANSCRIBED_PREFIX}"${text.replace(/\s+/g, ' ').trim().slice(0, 3000)}"`;
}

/** Baixa a mídia da Meta (2 passos: pega a URL temporária, depois o arquivo com o token). */
async function downloadMetaMedia(mediaId: string, accessToken: string): Promise<Buffer | null> {
  const metaRes = await metaFetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) return null;
  const info = (await metaRes.json()) as { url?: string; file_size?: number };
  if (!info.url || (info.file_size && info.file_size > MAX_AUDIO_BYTES)) return null;
  const fileRes = await metaFetch(info.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!fileRes.ok) return null;
  const buf = Buffer.from(await fileRes.arrayBuffer());
  return buf.length > MAX_AUDIO_BYTES ? null : buf;
}

async function transcribe(apiKey: string, model: string, audio: Buffer, mimeType: string, usage: TokenUsage): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType, data: audio.toString('base64') } },
            {
              text: 'Transcreva fielmente a fala deste áudio de WhatsApp, em português do Brasil. Responda só com a transcrição, sem comentários nem aspas. Se não houver fala compreensível, responda exatamente: [sem fala]',
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) {
    logger.warn('assistant.audio_transcription_http', { status: res.status });
    return null;
  }
  const data = await res.json();
  addUsage(usage, data?.usageMetadata);
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || '')
    .join('')
    .trim();
  if (!text || /^\[sem fala\]$/i.test(text)) return null;
  return text;
}

/**
 * Transcreve os áudios mais recentes do cliente que ainda estão como "[audio]".
 * Nunca lança: sem transcrição, a atendente segue e pede para o cliente escrever.
 */
export async function transcribePendingAudios(input: {
  tenantId: string;
  leadId: string;
  /** Token do WhatsApp da conta; só é buscado se houver áudio para transcrever. */
  getAccessToken: () => Promise<string | null>;
  apiKey: string;
  model: string;
  usage: TokenUsage;
  /** Passou disso, para de transcrever: o resto do tempo é da resposta. */
  deadline: number;
}): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('id, media_url')
      .eq('tenant_id', input.tenantId)
      .eq('lead_id', input.leadId)
      .eq('direction', 'INBOUND')
      .eq('body', '[audio]')
      .like('media_url', `${META_MEDIA_PREFIX}%`)
      .order('created_at', { ascending: false })
      .limit(MAX_AUDIOS_PER_RUN);

    if (!data?.length) return 0;
    const accessToken = await input.getAccessToken();
    if (!accessToken) return 0;

    let done = 0;
    for (const row of data) {
      if (Date.now() > input.deadline) break;
      const media = parseMetaMedia(row.media_url);
      if (!media) continue;
      const audio = await downloadMetaMedia(media.id, accessToken);
      if (!audio) {
        logger.warn('assistant.audio_download_failed', { tenantId: input.tenantId });
        continue;
      }
      const text = await transcribe(input.apiKey, input.model, audio, media.mimeType, input.usage);
      if (!text) continue;
      await supabaseAdmin
        .from('chat_messages')
        .update({ body: transcribedBody(text) })
        .eq('id', row.id)
        .eq('tenant_id', input.tenantId);
      done++;
    }
    if (done) logger.info('assistant.audio_transcribed', { tenantId: input.tenantId, count: done });
    return done;
  } catch (err) {
    logger.warn('assistant.audio_transcription_failed', {
      tenantId: input.tenantId,
      message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
