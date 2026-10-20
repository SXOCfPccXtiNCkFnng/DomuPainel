import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { ensureReminderTemplate } from '@/lib/appointmentReminders';
import { validateSchedulingSettings } from '@/lib/scheduling';
import {
  isSchemaPendingError,
  loadSchedulingSettings,
  SCHEDULING_MIGRATION_PENDING,
} from '@/lib/schedulingServer';

export const dynamic = 'force-dynamic';

/** Horário de funcionamento e regras da agenda. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const settings = await loadSchedulingSettings(auth.session.tenantId);
    return NextResponse.json({
      success: true,
      settings,
      canEdit: auth.session.role === 'ADMIN' || auth.session.role === 'SUPER_ADMIN',
    });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) {
      return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
    }
    return internalErrorResponse('api.scheduling.settings.get', error);
  }
}

/** Salva a configuração (só administrador). */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateSchedulingSettings(body);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const { error } = await supabaseAdmin.from('scheduling_settings').upsert(
      {
        tenant_id: auth.session.tenantId,
        ...parsed.settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );
    if (error) throw error;

    // Lembrete fora da janela de 24h precisa de modelo aprovado: já pede à Meta,
    // para estar aprovado quando o primeiro cliente precisar.
    if (parsed.settings.reminder_hour_enabled || parsed.settings.reminder_soon_minutes > 0) {
      const tenantId = auth.session.tenantId;
      after(() =>
        ensureReminderTemplate(tenantId).catch((err) =>
          logger.warn('reminders.template_ensure_failed', {
            tenantId,
            message: err instanceof Error ? err.message : String(err),
          })
        )
      );
    }

    return NextResponse.json({ success: true, settings: parsed.settings });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) {
      return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
    }
    return internalErrorResponse('api.scheduling.settings.put', error);
  }
}
