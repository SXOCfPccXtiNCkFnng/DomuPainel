import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { aiAvailable, generateAi } from '@/lib/aiClient';
import { brtMonthStartIso } from '@/lib/assistantUsage';
import { ASK_SUGGESTIONS, askKindFor, askSystemPrompt, buildAskContext, QUESTION_MAX } from '@/lib/askAi';
import { getPlanAiQuestionLimit, getPlanDisplayName, planHasSalesIntelligence } from '@/lib/planLimits';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function loadAccess(tenantId: string) {
  const [{ data: sub }, { data: tenant }] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle(),
    supabaseAdmin.from('tenants').select('name, segment').eq('id', tenantId).maybeSingle(),
  ]);
  return {
    allowed: planHasSalesIntelligence(sub?.plan_tier),
    limit: getPlanAiQuestionLimit(sub?.plan_tier),
    planName: getPlanDisplayName(sub?.plan_tier),
    kind: askKindFor(tenant?.segment),
    company: tenant?.name || '',
  };
}

async function usedThisMonth(tenantId: string): Promise<{ used: number; tableReady: boolean }> {
  const { count, error } = await supabaseAdmin
    .from('ai_questions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', brtMonthStartIso());
  if (isMissingTable(error)) return { used: 0, tableReady: false };
  if (error) throw error;
  return { used: count ?? 0, tableReady: true };
}

/** Histórico (últimas 10 perguntas), cota do mês e sugestões. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const access = await loadAccess(tenantId);
    if (!access.allowed || !access.kind) return NextResponse.json({ success: true, locked: true, planName: access.planName });

    const [{ used }, history] = await Promise.all([
      usedThisMonth(tenantId),
      supabaseAdmin
        .from('ai_questions')
        .select('id, question, answer, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    return NextResponse.json({
      success: true,
      locked: false,
      used,
      limit: access.limit,
      suggestions: ASK_SUGGESTIONS[access.kind],
      history: history.error ? [] : history.data || [],
      aiAvailable: aiAvailable(),
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.insights.ask.get', error);
  }
}

/** Faz uma pergunta: { question }. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const access = await loadAccess(tenantId);
    if (!access.allowed || !access.kind) {
      return NextResponse.json({ success: false, error: 'Pergunte para a IA é do plano Pro para cima.' }, { status: 403 });
    }
    if (!aiAvailable()) return NextResponse.json({ success: false, error: 'A IA ainda não foi liberada no servidor.' }, { status: 503 });

    const body = (await req.json().catch(() => ({}))) as { question?: unknown };
    const question = String(body.question ?? '').replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX);
    if (question.length < 4) return NextResponse.json({ success: false, error: 'Escreva sua pergunta.' }, { status: 400 });

    const { used, tableReady } = await usedThisMonth(tenantId);
    if (used >= access.limit) {
      return NextResponse.json(
        { success: false, error: `Você já usou as ${access.limit} perguntas do mês do plano ${access.planName}. Elas voltam no dia 1º.` },
        { status: 429 }
      );
    }
    // Sem a tabela (migration pendente) a cota não conta: segura por um limite curto.
    const burst = await checkRateLimitDurable(`ask-ai:${tenantId}`, tableReady ? 10 : 5, 10 * 60 * 1000);
    if (!burst.ok) return NextResponse.json({ success: false, error: 'Muitas perguntas seguidas. Espere alguns minutos.' }, { status: 429 });

    const context = await buildAskContext(tenantId, access.kind);
    const result = await generateAi({
      system: askSystemPrompt(access.company, access.kind),
      parts: [{ text: `DADOS DA CONTA\n${context}\n\nPERGUNTA DO DONO\n${question}` }],
      maxOutputTokens: 1500,
      temperature: 0.3,
      label: 'ask_ai',
    });
    if (!result) return NextResponse.json({ success: false, error: 'A IA não conseguiu responder agora. Tente de novo.' }, { status: 502 });
    const answer = result.text.replace(/[*#]/g, '').trim().slice(0, 2000);

    const { data: saved } = await supabaseAdmin
      .from('ai_questions')
      .insert({ tenant_id: tenantId, user_id: auth.session.userId, question, answer, cost_usd: result.costUsd })
      .select('id, question, answer, created_at')
      .maybeSingle();
    return NextResponse.json({
      success: true,
      item: saved || { id: String(Date.now()), question, answer, created_at: new Date().toISOString() },
      used: used + 1,
      limit: access.limit,
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.insights.ask.post', error);
  }
}
