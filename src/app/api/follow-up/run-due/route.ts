import { NextRequest, NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cronAuth';
import { failStuckFollowUps, processDueFollowUps } from '@/lib/followUp';
import { describeError, withTransientRetry } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron (a cada 15 min): envia os follow-ups automáticos vencidos.
 * Authorization: Bearer CRON_SECRET (mesmo esquema de /api/campaigns/run-due).
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
  }

  try {
    await failStuckFollowUps();
    const result = await withTransientRetry(() => processDueFollowUps({ limit: 50, deadlineMs: 45_000 }));
    if (result.checked > 0) logger.info('followup.run_due', result);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = describeError(error);
    logger.error('followup.run_due_error', { message });
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.follow-up', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
