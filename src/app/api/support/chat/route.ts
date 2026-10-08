import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { formatSupportKnowledge } from '@/lib/supportKnowledge';

export const dynamic = 'force-dynamic';

const MODELS = ['gemini-3.8-flash'];

type HistoryItem = { role: 'user' | 'bot'; text: string };

function clip(value: unknown, max: number): string {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function systemPrompt(): string {
  return `Você é o assistente de suporte da Domu Tech, dentro do portal logado.
Responda em português do Brasil, objetivo, em no máximo 8 frases curtas.
Pode usar **negrito** e listas com "1." ou "•".

Regras:
- Use somente o conhecimento abaixo e o que o usuário já disse nesta conversa.
- Não invente preço, prazo de aprovação, ID de app, limite exato do número do cliente nem passo que não esteja no texto.
- A Domu usa a API oficial da Meta (Cloud API). Não sugira Baileys, WhatsApp Web, Evolution ou QR de sessão não oficial.
- Coexistência = mesmo número no WhatsApp Business (app verde) e na API. Número pessoal não serve.
- Se a pergunta for sobre a conta específica do cliente (cobrança dele, status do número, erro que só a Meta vê), diga que não enxerga a conta e marque offerHuman como true.
- Se não souber, diga isso com clareza e marque offerHuman como true.
- Nunca peça senha, token, cartão ou código de verificação.

Responda APENAS um JSON válido:
{"answer":"texto para o usuário","offerHuman":false}

Conhecimento da plataforma e da Meta no produto Domu:
${formatSupportKnowledge()}`;
}

async function askGemini(message: string, history: HistoryItem[]): Promise<{ answer: string; offerHuman: boolean } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const contents = [
    ...history.slice(-8).map((item) => ({
      role: item.role === 'bot' ? 'model' : 'user',
      parts: [{ text: clip(item.text, 1500) }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt() }] },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
      }
    );
    if (res.status === 404) continue;
    if (!res.ok) {
      console.error('Gemini support chat failed', model, res.status);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    const parsed = parseModelJson(text);
    if (parsed) return parsed;
  }
  return null;
}

function parseModelJson(raw: string): { answer: string; offerHuman: boolean } | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  try {
    const json = JSON.parse(trimmed) as { answer?: unknown; offerHuman?: unknown };
    const answer = clip(json.answer, 2500);
    if (!answer) return null;
    return { answer, offerHuman: json.offerHuman === true };
  } catch {
    const answer = clip(trimmed, 2500);
    return answer ? { answer, offerHuman: false } : null;
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const message = clip(body?.message, 1000);
  if (message.length < 2) {
    return NextResponse.json({ success: false, error: 'Escreva uma pergunta.' }, { status: 400 });
  }

  const history = Array.isArray(body?.history)
    ? (body.history as HistoryItem[])
        .filter((item) => item && (item.role === 'user' || item.role === 'bot') && item.text)
        .slice(-8)
        .map((item) => ({ role: item.role, text: clip(item.text, 1500) }))
    : [];

  try {
    const result = await askGemini(message, history);
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Assistente indisponível no momento.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Support chat error', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Não foi possível responder agora.' }, { status: 500 });
  }
}
