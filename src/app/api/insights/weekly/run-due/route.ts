import { NextRequest, NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cronAuth';
import { processWeeklyInsights } from '@/lib/weeklyInsights';
import { isWeeklyInsightsTime } from '@/lib/weeklyInsightsRules';
import { describeError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recordHeartbeat } from '@/lib/heartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron (domingo, a cada 15 min das 18h às 23h de Brasília): dicas da semana
 * das contas com agenda. Fora desse horário só registra que rodou (pode chamar a cada 15 min a semana toda).
 * Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
  }
  const now = new Date();
  if (!isWeeklyInsightsTime(now)) {
    const skipped = 'Só gera os resumos no domingo, das 18h às 23h59 (Brasília).';
    await recordHeartbeat('cron.insights', { ok: true, result: { skipped } });
    return NextResponse.json({ success: true, skipped });
  }

  try {
    const result = await processWeeklyInsights({ deadlineMs: 40_000, now });
    if (result.checked > 0) logger.info('insights.run_due', result);
    await recordHeartbeat('cron.insights', { ok: true, result });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = describeError(error);
    await recordHeartbeat('cron.insights', { ok: false, error: message });
    logger.error('insights.run_due_error', { message });
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.insights', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
