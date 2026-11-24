/**
 * Chamada simples ao Gemini (texto, imagem ou PDF) para os recursos que não
 * são a atendente: importação de cardápio e "Pergunte para a IA".
 */
import { logger } from '@/lib/logger';
import { addUsage, costUsd, emptyUsage, type TokenUsage } from '@/lib/assistantUsage';

export const AI_MODEL = process.env.GEMINI_ASSISTANT_MODEL || 'gemini-3.8-flash';

export type AiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export function aiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateAi(params: {
  parts: AiPart[];
  system?: string;
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  label: string;
}): Promise<{ text: string; usage: TokenUsage; costUsd: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 45_000);
  const usage = emptyUsage();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        ...(params.system ? { systemInstruction: { parts: [{ text: params.system }] } } : {}),
        contents: [{ role: 'user', parts: params.parts }],
        generationConfig: {
          temperature: params.temperature ?? 0.3,
          maxOutputTokens: params.maxOutputTokens ?? 1500,
          ...(params.json ? { responseMimeType: 'application/json' } : {}),
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      logger.warn('ai.http_error', { label: params.label, status: res.status });
      return null;
    }
    const data = await res.json();
    addUsage(usage, data?.usageMetadata);
    // Parou no limite: JSON cortado não serve; texto cortado fica registrado para aumentar o limite.
    if (data?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      logger.warn('ai.max_tokens', { label: params.label, output: data?.usageMetadata?.candidatesTokenCount ?? null, thoughts: data?.usageMetadata?.thoughtsTokenCount ?? null });
      if (params.json) return null;
    }
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text || '')
      .join('')
      .trim();
    const cost = costUsd(usage, AI_MODEL);
    logger.info('ai.usage', { label: params.label, input: usage.input, output: usage.output, costUsd: cost });
    return text ? { text, usage, costUsd: cost } : null;
  } catch (err) {
    logger.warn('ai.failed', { label: params.label, message: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON às vezes vem dentro de ```json ... ```. */
export function parseAiJson(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
