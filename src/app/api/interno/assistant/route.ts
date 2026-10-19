import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { internalErrorResponse } from '@/lib/errors';
import {
  loadAssistantMetrics,
  loadAssistantRuns,
  loadConversation,
  reviewAssistantRun,
} from '@/lib/assistantMetrics';
import type { AssistantFlag, AssistantRunStatus } from '@/lib/assistantUsage';

export const dynamic = 'force-dynamic';

const STATUSES: AssistantRunStatus[] = ['REPLIED', 'SKIPPED', 'NO_REPLY', 'FAILED', 'SUPERSEDED'];
const FLAGS: AssistantFlag[] = ['VALOR_NAO_CADASTRADO', 'HORARIO_SEM_AGENDA', 'NAO_SABIA', 'CHAMOU_EQUIPE', 'ERRO_FERRAMENTA'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consumo e monitor da atendente de IA.
 * ?view=metrics&days=&tenantId=          → números agregados
 * ?view=runs&days=&tenantId=&status=&flag=&review=&q=  → respostas para revisar
 * ?view=conversation&tenantId=&leadId=   → conversa completa
 */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const q = new URL(req.url).searchParams;
    const view = q.get('view') || 'metrics';
    const days = Math.min(Math.max(Number(q.get('days')) || 30, 1), 365);
    const tenantId = UUID_RE.test(q.get('tenantId') || '') ? q.get('tenantId') : null;

    if (view === 'conversation') {
      const leadId = q.get('leadId') || '';
      if (!tenantId || !UUID_RE.test(leadId)) {
        return NextResponse.json({ success: false, error: 'Informe a empresa e o contato.' }, { status: 400 });
      }
      const messages = await loadConversation(tenantId, leadId);
      const runs = await loadAssistantRuns({ days: 365, tenantId, limit: 300 });
      return NextResponse.json({ success: true, messages, runs: runs.filter((r) => r.leadId === leadId) });
    }

    if (view === 'runs') {
      const status = STATUSES.find((s) => s === q.get('status')) || null;
      const flag = FLAGS.find((f) => f === q.get('flag')) || null;
      const reviewParam = q.get('review');
      const review = reviewParam === 'OK' || reviewParam === 'BAD' || reviewParam === 'PENDING' ? reviewParam : null;
      const runs = await loadAssistantRuns({ days, tenantId, status, flag, review, search: q.get('q'), limit: 150 });
      return NextResponse.json({ success: true, runs });
    }

    const metrics = await loadAssistantMetrics({ days, tenantId });
    if ('missingTable' in metrics) {
      return NextResponse.json({
        success: true,
        missingTable: true,
        message: 'Aplique a migration 20261019_assistant_runs.sql no Supabase para começar a registrar o consumo.',
      });
    }
    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    return internalErrorResponse('interno.assistant', error);
  }
}

/** Revisão manual de uma resposta: { id, review: 'OK' | 'BAD' | null, note } */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; review?: string | null; note?: string | null };
    if (!body.id || !UUID_RE.test(body.id)) {
      return NextResponse.json({ success: false, error: 'Informe a resposta.' }, { status: 400 });
    }
    const review = body.review === 'OK' || body.review === 'BAD' ? body.review : null;
    const ok = await reviewAssistantRun(body.id, review, body.note ?? null, gate.email);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return internalErrorResponse('interno.assistant.review', error);
  }
}
