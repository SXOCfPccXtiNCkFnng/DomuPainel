import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { formatSupportKnowledge } from '@/lib/supportKnowledge';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPhoneNumberQuality, resolveMetaCredentials } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';

const MODELS = ['gemini-3.8-flash'];

type HistoryItem = { role: 'user' | 'bot'; text: string };

function clip(value: unknown, max: number): string {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function systemPrompt(accountContext: string): string {
  return `Você é o assistente de suporte da Domu Tech, dentro do portal logado.
Responda em português do Brasil, objetivo, em no máximo 8 frases curtas.
Pode usar **negrito** e listas com "1." ou "•".

Regras:
- Use o conhecimento da plataforma e os dados reais da conta abaixo. Quando a pessoa perguntar do número, plano, qualidade, limite, templates ou contatos dela, responda com esses dados.
- Não invente preço, prazo, ID de app nem um número que não esteja nos dados da conta.
- A Domu usa a API oficial da Meta (Cloud API). Não sugira Baileys, WhatsApp Web, Evolution ou QR de sessão não oficial.
- Coexistência = mesmo número no WhatsApp Business (app verde) e na API. Número pessoal não serve.
- Se os dados da conta não tiverem o que ela perguntou, diga isso e marque offerHuman como true.
- Nunca peça senha, token, cartão ou código de verificação.
- Nunca repita token de acesso.

Responda APENAS um JSON válido:
{"answer":"texto para o usuário","offerHuman":false}

Dados reais desta conta:
${accountContext}

Conhecimento da plataforma e da Meta no produto Domu:
${formatSupportKnowledge()}`;
}

async function loadAccountContext(tenantId: string): Promise<string> {
  const [{ data: tenant }, { data: subscription }, { count: contacts }, { count: optedOut }, { count: campaigns }, { data: templates }] =
    await Promise.all([
      supabaseAdmin.from('tenants').select('name, whatsapp_number, segment').eq('id', tenantId).maybeSingle(),
      supabaseAdmin.from('subscriptions').select('plan_tier, status').eq('tenant_id', tenantId).maybeSingle(),
      supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('opt_in', false),
      supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('hsm_templates').select('status').eq('tenant_id', tenantId),
    ]);

  const templateRows = templates || [];
  const approved = templateRows.filter((row) => row.status === 'APPROVED').length;
  const pending = templateRows.filter((row) => row.status === 'PENDING').length;
  const rejected = templateRows.filter((row) => row.status === 'REJECTED').length;

  let whatsapp = 'WhatsApp não conectado nesta conta.';
  try {
    const creds = await resolveMetaCredentials(tenantId);
    const quality = await getPhoneNumberQuality(creds);
    whatsapp = `WhatsApp conectado. Número exibido: ${quality.displayPhoneNumber || tenant?.whatsapp_number || 'não informado'}. Qualidade Meta: ${quality.qualityRating}. Limite: ${quality.messagingLimitTier || 'não informado'}. Status do nome: ${quality.nameStatus || 'não informado'}.`;
  } catch {
    if (tenant?.whatsapp_number) {
      whatsapp = `Número cadastrado na Domu: ${tenant.whatsapp_number}, mas a API da Meta não confirmou a conexão agora.`;
    }
  }

  return [
    `Empresa: ${tenant?.name || 'não informada'}`,
    `Segmento: ${tenant?.segment || 'não informado'}`,
    `Plano: ${subscription?.plan_tier || 'não informado'} (${subscription?.status || 'sem assinatura'})`,
    whatsapp,
    `Contatos: ${contacts || 0}. Pediram para não receber: ${optedOut || 0}.`,
    `Campanhas criadas: ${campaigns || 0}.`,
    `Templates: ${approved} aprovados, ${pending} pendentes, ${rejected} rejeitados, ${templateRows.length} no total.`,
  ].join('\n');
}

async function askGemini(
  message: string,
  history: HistoryItem[],
  accountContext: string
): Promise<{ answer: string; offerHuman: boolean } | null> {
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
    system_instruction: { parts: [{ text: systemPrompt(accountContext) }] },
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
  const auth = await requireAuth(req);
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
    const accountContext = await loadAccountContext(auth.session.tenantId);
    const result = await askGemini(message, history, accountContext);
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
