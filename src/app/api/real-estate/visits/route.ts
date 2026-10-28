import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { isSchemaPendingError } from '@/lib/schedulingServer';
import { isVisitStatus, realEstateModeForPlan } from '@/lib/realEstate';
import { isValidReminderMinutes } from '@/lib/visitReminderRules';
import { ensureVisitReminderTemplate } from '@/lib/visitReminders';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION_PENDING = 'Os pedidos de visita ainda não foram ativados no banco (migration 20261021_real_estate.sql).';
const REMINDER_MIGRATION_PENDING =
  'A data da visita e o lembrete ainda não foram ativados no banco (migration 20261028_visit_reminders.sql).';
const PRO_ONLY = 'Agendar visitas com lembrete é do plano Pro.';

const BASE_COLUMNS =
  'id, lead_id, property_id, property_label, customer_name, customer_phone, preferred_time, notes, status, created_at';
const SCHEDULE_COLUMNS = 'scheduled_at, reminder_minutes, reminder_sent_at, reminder_status, reminder_note';

function isMissing(error: { code?: string } | null): boolean {
  return Boolean(error && (isSchemaPendingError(error) || error.code === 'PGRST205' || error.code === 'PGRST204'));
}

async function planAllowsVisits(tenantId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle();
  return realEstateModeForPlan(data?.plan_tier) === 'COMPLETO';
}

/**
 * Data e hora da visita + antecedência do lembrete (minutos; null = sem aviso).
 * A data precisa ser futura; o lembrete, caber antes dela.
 */
function parseSchedule(body: Record<string, unknown>): { ok: true; scheduledAt: string; reminderMinutes: number | null } | { ok: false; error: string } {
  const when = new Date(String(body.scheduledAt ?? ''));
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'Informe a data e a hora da visita.' };
  if (when.getTime() < Date.now() - 5 * 60 * 1000) return { ok: false, error: 'A data da visita já passou.' };
  const raw = body.reminderMinutes;
  if (raw === null || raw === undefined || raw === '') return { ok: true, scheduledAt: when.toISOString(), reminderMinutes: null };
  const minutes = Number(raw);
  if (!isValidReminderMinutes(minutes)) {
    return { ok: false, error: 'O aviso precisa ser entre 5 minutos e 7 dias antes da visita.' };
  }
  return { ok: true, scheduledAt: when.toISOString(), reminderMinutes: minutes };
}

/** Prepara o modelo do lembrete na Meta logo ao agendar (para estar aprovado na hora de avisar). */
function warmTemplate(tenantId: string, reminderMinutes: number | null) {
  if (reminderMinutes == null) return;
  after(() =>
    ensureVisitReminderTemplate(tenantId).catch((err) =>
      logger.warn('visit_reminders.template_ensure_failed', {
        tenantId,
        message: err instanceof Error ? err.message : String(err),
      })
    )
  );
}

async function markLeadVisitScheduled(tenantId: string, leadId: string | null) {
  if (!leadId) return;
  await supabaseAdmin
    .from('leads')
    .update({ status: 'VISITA_AGENDADA', updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .in('status', ['NOVO', 'EM_ATENDIMENTO']);
}

/** Pedidos de visita da atendente e visitas marcadas pelo corretor (plano Pro). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const select = (columns: string) =>
      supabaseAdmin
        .from('visit_requests')
        .select(columns)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
    let visitsRes = await select(`${BASE_COLUMNS}, ${SCHEDULE_COLUMNS}`);
    let scheduleAvailable = true;
    if (visitsRes.error?.code === '42703') {
      scheduleAvailable = false;
      visitsRes = await select(BASE_COLUMNS);
    }
    if (isMissing(visitsRes.error)) {
      return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
    }
    if (visitsRes.error) throw visitsRes.error;

    return NextResponse.json({
      success: true,
      visits: visitsRes.data || [],
      planAllowsVisits: await planAllowsVisits(tenantId),
      scheduleAvailable,
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.visits.get', error);
  }
}

/**
 * Corretor marca uma visita direto para um lead (página Leads):
 * { leadId, propertyId?, scheduledAt, reminderMinutes?, notes? }.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    if (!(await planAllowsVisits(tenantId))) return NextResponse.json({ success: false, error: PRO_ONLY }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const leadId = String(body.leadId || '');
    if (!UUID_RE.test(leadId)) return NextResponse.json({ success: false, error: 'Escolha o cliente.' }, { status: 400 });
    const schedule = parseSchedule(body);
    if (!schedule.ok) return NextResponse.json({ success: false, error: schedule.error }, { status: 400 });

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!lead) return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });

    let propertyId: string | null = null;
    let propertyLabel: string | null = null;
    if (body.propertyId) {
      const { data: property } = await supabaseAdmin
        .from('properties')
        .select('id, code, title')
        .eq('id', String(body.propertyId))
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!property) return NextResponse.json({ success: false, error: 'Imóvel não encontrado.' }, { status: 404 });
      propertyId = property.id;
      propertyLabel = `${property.code} · ${property.title}`.slice(0, 300);
    }

    const notes = String(body.notes ?? '').trim().slice(0, 500) || null;
    const { data, error } = await supabaseAdmin
      .from('visit_requests')
      .insert({
        tenant_id: tenantId,
        lead_id: lead.id,
        property_id: propertyId,
        property_label: propertyLabel,
        customer_name: lead.name,
        customer_phone: lead.phone,
        preferred_time: null,
        notes,
        status: 'CONFIRMED',
        source: 'PANEL',
        scheduled_at: schedule.scheduledAt,
        reminder_minutes: schedule.reminderMinutes,
      })
      .select(`${BASE_COLUMNS}, ${SCHEDULE_COLUMNS}`)
      .single();
    if (isMissing(error) || error?.code === '42703') {
      return NextResponse.json({ success: false, error: REMINDER_MIGRATION_PENDING }, { status: 503 });
    }
    if (error) throw error;

    await markLeadVisitScheduled(tenantId, lead.id);
    warmTemplate(tenantId, schedule.reminderMinutes);
    return NextResponse.json({ success: true, visit: data });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.visits.post', error);
  }
}

/**
 * Muda o status: { id, status }. Ao confirmar (ou remarcar), manda também
 * { scheduledAt, reminderMinutes } — a data combinada e o aviso ao cliente.
 * Confirmada → o lead vai para "Visita marcada".
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!UUID_RE.test(String(body.id || ''))) {
      return NextResponse.json({ success: false, error: 'Informe o pedido de visita.' }, { status: 400 });
    }
    if (!isVisitStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { status: body.status, updated_at: new Date().toISOString() };
    let reminderMinutes: number | null = null;
    if (body.status === 'CONFIRMED' && body.scheduledAt !== undefined) {
      if (!(await planAllowsVisits(tenantId))) return NextResponse.json({ success: false, error: PRO_ONLY }, { status: 403 });
      const schedule = parseSchedule(body);
      if (!schedule.ok) return NextResponse.json({ success: false, error: schedule.error }, { status: 400 });
      reminderMinutes = schedule.reminderMinutes;
      // Data nova (ou remarcada): o lembrete volta a valer para ela.
      Object.assign(patch, {
        scheduled_at: schedule.scheduledAt,
        reminder_minutes: schedule.reminderMinutes,
        reminder_sent_at: null,
        reminder_status: null,
        reminder_note: null,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('visit_requests')
      .update(patch)
      .eq('id', String(body.id))
      .eq('tenant_id', tenantId)
      .select(BASE_COLUMNS)
      .maybeSingle();
    if (error?.code === '42703' || error?.code === 'PGRST204') {
      return NextResponse.json({ success: false, error: REMINDER_MIGRATION_PENDING }, { status: 503 });
    }
    if (isMissing(error)) return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });

    if (body.status === 'CONFIRMED') {
      await markLeadVisitScheduled(tenantId, data.lead_id);
      warmTemplate(tenantId, reminderMinutes);
    }
    return NextResponse.json({ success: true, visit: data });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.visits.patch', error);
  }
}
