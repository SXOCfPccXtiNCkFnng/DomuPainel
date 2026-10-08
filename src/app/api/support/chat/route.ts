import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { formatSupportKnowledge } from '@/lib/supportKnowledge';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPhoneNumberQuality, resolveMetaCredentials } from '@/lib/metaClient';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  getPlanDailyLimit,
  getPlanMonthlyLimit,
  getPlanUserLimit,
  isUnlimitedPlanLimit,
  normalizePlanTier,
} from '@/lib/planLimits';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import { TenantSegment } from '@/types';

export const dynamic = 'force-dynamic';

const MODELS = ['gemini-3.8-flash'];

type HistoryItem = { role: 'user' | 'bot'; text: string };
type ChatReply = { answer: string; offerHuman: boolean; suggestions: string[] };

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/disparos': 'Disparo de Campanha',
  '/templates': 'Templates de Mensagens',
  '/contatos': 'Contatos e Segmentação',
  '/metricas': 'Métricas',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações',
  '/assinatura': 'Assinatura e Planos',
  '/imoveis': 'Imóveis',
  '/atendimento': 'Leads e Respostas',
  '/onboarding': 'Cadastro inicial (onboarding)',
};

const CAMPAIGN_STATUS_PT: Record<string, string> = {
  DRAFT: 'rascunho',
  SCHEDULED: 'agendada',
  RUNNING: 'enviando',
  COMPLETED: 'concluída',
  FAILED: 'falhou',
  PAUSED: 'pausada',
};

const ROLE_PT: Record<string, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN: 'Administrador',
  BROKER: 'Corretor (pode disparar)',
  ATTENDANT: 'Atendente (não dispara campanhas)',
};

function clip(value: unknown, max: number): string {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'não informado';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function systemPrompt(accountContext: string): string {
  return `Você é o assistente de suporte da Domu Tech, dentro do portal logado. A Domu é uma plataforma de disparo de campanhas pelo WhatsApp usando a API oficial da Meta (Cloud API).

Como responder:
- Português do Brasil, tom próximo e direto, como um bom atendente humano.
- Responda de verdade, com o nível de detalhe que a pergunta pede: pergunta simples → 1 a 3 frases; "como faço" → passo a passo numerado com os nomes exatos dos menus e botões; problema → diagnóstico.
- Para problemas (campanha falhou, mensagem não chegou, template rejeitado, limite), use os DADOS REAIS DA CONTA abaixo: cite a campanha, o status, o erro registrado, o uso do plano. Diga a causa mais provável e o que fazer agora.
- Se a pergunta for ambígua, responda o caso mais provável e pergunte o que faltou em uma frase.
- Leve em conta a página em que a pessoa está e a função dela (ex.: Atendente não dispara campanhas; só Administrador mexe em equipe, assinatura e conexão).
- Use **negrito** para nomes de menus/botões e listas com "1." ou "•". Sem títulos markdown (#), sem tabelas.
- Limite de tamanho: até ~180 palavras. Prefira passos concretos a explicações genéricas.

Regras:
- Não invente preço, prazo, limite, ID ou funcionalidade que não esteja nos dados abaixo. Se não souber, diga e ofereça o atendimento humano (offerHuman = true).
- A Domu usa só a API oficial. Nunca sugira Baileys, WhatsApp Web, Evolution, extensões ou QR de sessão não oficial.
- Coexistência = mesmo número no WhatsApp Business (app verde) e na API. Número pessoal não serve.
- Nunca peça senha, token, cartão ou código de verificação, e nunca repita tokens.
- Ofereça atendimento humano (offerHuman = true) quando: a pessoa pedir; for problema de pagamento/cobrança que exija ação manual; erro que você não consegue explicar pelos dados; pedido de cancelamento ou reembolso.

Responda APENAS um JSON válido neste formato:
{"answer":"texto para o usuário","offerHuman":false,"suggestions":["pergunta curta 1","pergunta curta 2"]}
"suggestions": 2 ou 3 próximas perguntas curtas (máx. 45 caracteres cada) que façam sentido como continuação da conversa, escritas como o usuário escreveria.

DADOS REAIS DESTA CONTA (consultados agora):
${accountContext}

CONHECIMENTO DA PLATAFORMA E DA META:
${formatSupportKnowledge()}`;
}

async function countSentSince(tenantId: string, sinceIso: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('sent_count')
    .eq('tenant_id', tenantId)
    .gte('created_at', sinceIso);
  return (data || []).reduce(
    (sum, row: { sent_count: number | null }) => sum + Number(row.sent_count || 0),
    0
  );
}

async function loadAccountContext(
  tenantId: string,
  userId: string,
  role: string,
  pathname: string
): Promise<string> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: tenant },
    { data: user },
    { data: subscription },
    { count: contacts },
    { count: optedOut },
    { count: teamCount },
    { data: templates },
    { data: campaigns },
    usedMonth,
    usedDay,
  ] = await Promise.all([
    supabaseAdmin.from('tenants').select('name, whatsapp_number, segment').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.from('users').select('name').eq('id', userId).maybeSingle(),
    supabaseAdmin
      .from('subscriptions')
      .select('plan_tier, status, payment_method, current_period_end, monthly_message_limit')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('opt_in', false),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabaseAdmin
      .from('hsm_templates')
      .select('name, status, category')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabaseAdmin
      .from('campaigns')
      .select(
        'id, name, status, scheduled_at, created_at, total_leads, sent_count, delivered_count, read_count, failed_count'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
    countSentSince(tenantId, monthStart.toISOString()),
    countSentSince(tenantId, dayStart.toISOString()),
  ]);

  // Erros reais das campanhas recentes — é o que mais ajuda a diagnosticar.
  const campaignIds = (campaigns || []).map((c) => c.id);
  const { data: failedLogs } = campaignIds.length
    ? await supabaseAdmin
        .from('campaign_logs')
        .select('campaign_id, error_message')
        .eq('tenant_id', tenantId)
        .in('campaign_id', campaignIds)
        .eq('status', 'FAILED')
        .not('error_message', 'is', null)
        .limit(200)
    : { data: [] as { campaign_id: string; error_message: string | null }[] };

  const errorsByCampaign = new Map<string, Map<string, number>>();
  for (const log of failedLogs || []) {
    const msg = clip(log.error_message, 220);
    if (!msg) continue;
    const bucket = errorsByCampaign.get(log.campaign_id) || new Map<string, number>();
    bucket.set(msg, (bucket.get(msg) || 0) + 1);
    errorsByCampaign.set(log.campaign_id, bucket);
  }

  const planTier = normalizePlanTier(subscription?.plan_tier);
  const fromSub = Number(subscription?.monthly_message_limit);
  const monthlyLimit = fromSub > 0 ? fromSub : getPlanMonthlyLimit(planTier);
  const dailyLimit = getPlanDailyLimit(planTier);

  let whatsapp = 'WhatsApp NÃO conectado nesta conta (a conexão fica em Configurações).';
  try {
    const creds = await resolveMetaCredentials(tenantId);
    const quality = await getPhoneNumberQuality(creds);
    whatsapp = `WhatsApp conectado. Número: ${quality.displayPhoneNumber || tenant?.whatsapp_number || 'não informado'}. Qualidade Meta: ${quality.qualityRating}. Limite Meta (conversas/24h): ${quality.messagingLimitTier || 'não informado'}. Status do nome: ${quality.nameStatus || 'não informado'}.`;
  } catch {
    if (tenant?.whatsapp_number) {
      whatsapp = `Número cadastrado na Domu: ${tenant.whatsapp_number}, mas a API da Meta não confirmou a conexão agora (pode estar desconectado ou com token expirado).`;
    }
  }

  const templateLines = (templates || []).length
    ? (templates || []).map((t) => `  • ${t.name} — ${t.status} (${t.category})`).join('\n')
    : '  • nenhum template cadastrado';

  const campaignLines = (campaigns || []).length
    ? (campaigns || [])
        .map((c) => {
          const statusKey = String(c.status || '').toUpperCase();
          const status = CAMPAIGN_STATUS_PT[statusKey] || c.status;
          const when =
            statusKey === 'SCHEDULED'
              ? `agendada para ${formatDate(c.scheduled_at)}`
              : `criada em ${formatDate(c.created_at)}`;
          let line = `  • "${c.name}" — ${status}, ${when}. Contatos: ${c.total_leads || 0}, enviadas: ${c.sent_count || 0}, entregues: ${c.delivered_count || 0}, lidas: ${c.read_count || 0}, falhas: ${c.failed_count || 0}.`;
          const errors = errorsByCampaign.get(c.id);
          if (errors?.size) {
            const top = [...errors.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([msg, n]) => `"${msg}" (${n}x)`)
              .join('; ');
            line += ` Erros registrados: ${top}.`;
          }
          return line;
        })
        .join('\n')
    : '  • nenhuma campanha criada ainda';

  const segment = (tenant?.segment || 'geral') as TenantSegment;

  return [
    `Usuário: ${user?.name || 'não informado'} — função: ${ROLE_PT[role] || role}.`,
    `Página aberta agora: ${PAGE_NAMES[pathname] || pathname || 'não informada'}.`,
    `Empresa: ${tenant?.name || 'não informada'}. Segmento: ${SEGMENT_LABELS[segment] || segment}.`,
    `Assinatura: plano ${planTier}, status ${subscription?.status || 'sem assinatura'}, pagamento ${subscription?.payment_method || 'não informado'}, período atual até ${formatDate(subscription?.current_period_end)}.`,
    `Uso do plano Domu: ${usedMonth} disparos este mês de ${isUnlimitedPlanLimit(monthlyLimit) ? 'ilimitado' : monthlyLimit}${dailyLimit != null ? `; hoje ${usedDay} de ${dailyLimit} (trava diária)` : ''}. Usuários: ${teamCount || 0} de ${getPlanUserLimit(planTier)}.`,
    whatsapp,
    `Contatos: ${contacts || 0} no total; ${optedOut || 0} pediram para não receber (opt-out).`,
    `Templates (mais recentes):\n${templateLines}`,
    `Campanhas recentes:\n${campaignLines}`,
  ].join('\n');
}

async function askGemini(
  message: string,
  history: HistoryItem[],
  accountContext: string
): Promise<ChatReply | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const contents = [
    ...history.map((item) => ({
      role: item.role === 'bot' ? 'model' : 'user',
      parts: [{ text: item.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt(accountContext) }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1500,
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
      // 429 = cota do plano gratuito do Gemini esgotada (por minuto ou por dia).
      console.error('Gemini support chat failed', model, res.status);
      return null;
    }
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    const parsed = parseModelJson(text);
    if (parsed) return parsed;
  }
  return null;
}

function parseModelJson(raw: string): ChatReply | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  try {
    const json = JSON.parse(trimmed) as { answer?: unknown; offerHuman?: unknown; suggestions?: unknown };
    const answer = clip(json.answer, 3000);
    if (!answer) return null;
    const suggestions = Array.isArray(json.suggestions)
      ? json.suggestions
          .map((s) => clip(s, 60))
          .filter((s) => s.length >= 3)
          .slice(0, 3)
      : [];
    return { answer, offerHuman: json.offerHuman === true, suggestions };
  } catch {
    const answer = clip(trimmed, 3000);
    return answer ? { answer, offerHuman: false, suggestions: [] } : null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  // A cota gratuita do Gemini é uma só para todos os clientes: um usuário em
  // loop não pode derrubar o chat dos outros.
  const limit = checkRateLimit(`support-chat:${auth.session.userId}`, 8, 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Muitas perguntas seguidas. Aguarde alguns segundos e tente de novo.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec || 30) } }
    );
  }

  const body = await req.json().catch(() => null);
  const message = clip(body?.message, 1000);
  if (message.length < 2) {
    return NextResponse.json({ success: false, error: 'Escreva uma pergunta.' }, { status: 400 });
  }
  const pathname = clip(body?.pathname, 80);

  const history = Array.isArray(body?.history)
    ? (body.history as HistoryItem[])
        .filter((item) => item && (item.role === 'user' || item.role === 'bot') && item.text)
        .slice(-10)
        .map((item) => ({ role: item.role, text: clip(item.text, 1500) }))
    : [];

  try {
    const accountContext = await loadAccountContext(
      auth.session.tenantId,
      auth.session.userId,
      auth.session.role,
      pathname
    );
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
