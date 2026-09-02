import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import {
  dispatchCampaignPending,
  processDueScheduledCampaigns,
} from '@/lib/campaignDispatch';

export const dynamic = 'force-dynamic';

function allowCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.DOMU_CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = req.headers.get('x-domu-cron-secret') || req.headers.get('authorization');
  if (!header) return false;
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === secret;
}

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
    });
    return NextResponse.json({ success: true, mode: 'single', result });
  }

  const { campaigns, results } = await processDueScheduledCampaigns({
    tenantId,
    limit: 20,
  });

  return NextResponse.json({
    success: true,
    mode: 'due',
    campaigns,
    results,
  });
}

/** Vercel Cron chama GET com Authorization: Bearer CRON_SECRET */
export async function GET(req: NextRequest) {
  try {
    if (!allowCron(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
    }
    return await handleRunDue(req, {});
  } catch (error: any) {
    console.error('[Campaigns run-due GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Dispara campanhas SCHEDULED cujo horário já passou.
 * - Cron: x-domu-cron-secret / Bearer CRON_SECRET
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
  } catch (error: any) {
    console.error('[Campaigns run-due POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
