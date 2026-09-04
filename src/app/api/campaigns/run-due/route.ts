import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import {
  dispatchCampaignPending,
  processDueScheduledCampaigns,
} from '@/lib/campaignDispatch';
import { isCronRequest } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';
/** Disparo sequencial pode passar de 10s — Pro/Enterprise na Vercel. */
export const maxDuration = 60;

const allowCron = isCronRequest;

async function handleRunDue(req: NextRequest, body: { campaignId?: string }) {
  const isCron = allowCron(req);
  let tenantId: string | undefined;

  if (!isCron) {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    tenantId = auth.session.tenantId;
  }

  if (body.campaignId) {
    const result = await dispatchCampaignPending(body.campaignId, {
      tenantId: isCron ? undefined : tenantId,
      force: Boolean(isCron),
    });
    return NextResponse.json({
      success: true,
      mode: 'single',
      source: isCron ? 'cron' : 'user',
      result,
    });
  }

  const { campaigns, results } = await processDueScheduledCampaigns({
    tenantId,
    limit: 20,
  });

  return NextResponse.json({
    success: true,
    mode: 'due',
    source: isCron ? 'cron' : 'user',
    campaigns,
    processed: results.filter((r) => !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  });
}

/** Vercel Cron: GET /api/campaigns/run-due com Authorization: Bearer CRON_SECRET */
export async function GET(req: NextRequest) {
  try {
    if (!allowCron(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
    }
    return await handleRunDue(req, {});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no cron.';
    console.error('[Campaigns run-due GET]', error);
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.run-due', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Dispara campanhas SCHEDULED cujo horário já passou.
 * - Cron: Authorization Bearer CRON_SECRET ou x-domu-cron-secret
 * - Usuário logado: só o próprio tenant (UI de progresso)
 * Body opcional: { campaignId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    let body: { campaignId?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    return await handleRunDue(req, body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no run-due.';
    console.error('[Campaigns run-due POST]', error);
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.run-due', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
