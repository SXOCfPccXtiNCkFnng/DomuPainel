import { NextRequest, NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cronAuth';
import { processDueReminders } from '@/lib/appointmentReminders';
import { processDueVisitReminders } from '@/lib/visitReminders';
import { describeError, withTransientRetry } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recordHeartbeat } from '@/lib/heartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron (a cada 5 min): lembretes do agendamento para o cliente (1h antes e em cima da hora)
 * e lembretes de visita do imobiliário (antecedência escolhida pelo corretor).
 * Authorization: Bearer CRON_SECRET (mesmo esquema de /api/campaigns/run-due).
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron.' }, { status: 401 });
  }

  try {
    // Agendamentos (lava rápido, saúde e beleza) e visitas (imobiliário), dividindo o tempo da função.
    const result = await withTransientRetry(() => processDueReminders({ limit: 100, deadlineMs: 28_000 }));
    const visits = await withTransientRetry(() => processDueVisitReminders({ limit: 200, deadlineMs: 17_000 }));
    if (result.checked > 0) logger.info('reminders.run_due', result);
    if (visits.checked > 0) logger.info('visit_reminders.run_due', visits);
    await recordHeartbeat('cron.reminders', { ok: true, result: { ...result, visits } });
    return NextResponse.json({ success: true, ...result, visits });
  } catch (error: unknown) {
    const message = describeError(error);
    await recordHeartbeat('cron.reminders', { ok: false, error: message });
    logger.error('reminders.run_due_error', { message });
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({ source: 'cron.reminders', message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
