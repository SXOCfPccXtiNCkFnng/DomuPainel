/**
 * Envia os lembretes de visita (imobiliário) no cron dos lembretes (a cada 5 min).
 * Dentro da janela de 24h vai texto livre; fora dela, o modelo aprovado que a
 * Domu cria sozinha na Meta. Exige assinatura ativa e número conectado; não
 * conta no limite de disparos do plano.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import { requireVerifiedWhatsApp } from '@/lib/whatsappConnection';
import { formatMetaError, sendMetaTemplate, sendMetaText, type MetaCredentials } from '@/lib/metaClient';
import { phoneLookupVariants } from '@/lib/phone';
import { isInsideServiceWindow } from '@/lib/appointmentReminderRules';
import { ensureUtilityTemplate, type TemplateState } from '@/lib/utilityTemplate';
import {
  isVisitReminderDue,
  renderVisitReminderTemplate,
  VISIT_REMINDER_MAX_MINUTES,
  VISIT_REMINDER_TEMPLATE_BODY,
  VISIT_REMINDER_TEMPLATE_PREFIX,
  visitReminderTemplateValues,
  visitReminderText,
} from '@/lib/visitReminderRules';

type VisitRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  property_label: string | null;
  customer_name: string;
  customer_phone: string;
  scheduled_at: string;
  reminder_minutes: number | null;
  reminder_sent_at: string | null;
};

type TenantContext = { blocked: string | null; credentials?: MetaCredentials; template?: TemplateState };

export type VisitReminderRunResult = { checked: number; sent: number; failed: number; skipped: number; waiting: number };

export function ensureVisitReminderTemplate(tenantId: string): Promise<TemplateState> {
  return ensureUtilityTemplate(tenantId, {
    prefix: VISIT_REMINDER_TEMPLATE_PREFIX,
    body: VISIT_REMINDER_TEMPLATE_BODY,
    variables: ['nome', 'imovel', 'quando'],
    label: 'do lembrete de visita',
    loadId: async () => {
      const { data, error } = await supabaseAdmin
        .from('tenants')
        .select('visit_reminder_template_id')
        .eq('id', tenantId)
        .maybeSingle();
      if (error) {
        if (error.code === '42703') return 'missing';
        throw error;
      }
      return data?.visit_reminder_template_id ?? null;
    },
    saveId: async (templateId) => {
      const { error } = await supabaseAdmin.from('tenants').update({ visit_reminder_template_id: templateId }).eq('id', tenantId);
      if (error) throw error;
    },
  });
}

async function loadTenantContext(tenantId: string): Promise<TenantContext> {
  const { data: sub } = await supabaseAdmin.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle();
  if (!isSubscriptionAllowedToDispatch(sub?.status)) return { blocked: 'Assinatura inativa ou vencida.' };
  const wa = await requireVerifiedWhatsApp(tenantId);
  if (!wa.ok) return { blocked: wa.error };
  return { blocked: null, credentials: wa.credentials };
}

async function findLead(row: VisitRow) {
  const columns = 'id, name, phone, opt_in';
  if (row.lead_id) {
    const { data } = await supabaseAdmin.from('leads').select(columns).eq('id', row.lead_id).eq('tenant_id', row.tenant_id).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabaseAdmin
    .from('leads')
    .select(columns)
    .eq('tenant_id', row.tenant_id)
    .in('phone', phoneLookupVariants(row.customer_phone))
    .limit(1)
    .maybeSingle();
  return data;
}

export async function processDueVisitReminders(options?: { limit?: number; deadlineMs?: number }): Promise<VisitReminderRunResult> {
  const result: VisitReminderRunResult = { checked: 0, sent: 0, failed: 0, skipped: 0, waiting: 0 };
  const runDeadline = Date.now() + (options?.deadlineMs ?? 20_000);
  const now = new Date();

  const { data: rows, error } = await supabaseAdmin
    .from('visit_requests')
    .select('id, tenant_id, lead_id, property_label, customer_name, customer_phone, scheduled_at, reminder_minutes, reminder_sent_at')
    .eq('status', 'CONFIRMED')
    .is('reminder_sent_at', null)
    .not('reminder_minutes', 'is', null)
    .gt('scheduled_at', now.toISOString())
    .lte('scheduled_at', new Date(now.getTime() + VISIT_REMINDER_MAX_MINUTES * 60 * 1000).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(options?.limit ?? 200);
  if (error) {
    if (['42P01', '42703', 'PGRST205'].includes(String(error.code))) return result; // migration pendente
    throw error;
  }

  const contexts = new Map<string, TenantContext>();
  const note = async (row: VisitRow, status: 'SENT' | 'FAILED' | 'SKIPPED' | null, text: string) => {
    await supabaseAdmin
      .from('visit_requests')
      .update({ ...(status ? { reminder_status: status } : {}), reminder_note: text.slice(0, 500) })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id);
  };

  for (const row of (rows || []) as VisitRow[]) {
    if (Date.now() > runDeadline) break;
    const scheduledAt = new Date(row.scheduled_at);
    if (!isVisitReminderDue({ scheduledAt, reminderMinutes: row.reminder_minutes, sentAt: null, now: new Date() })) continue;
    result.checked++;

    let ctx = contexts.get(row.tenant_id);
    if (!ctx) {
      ctx = await loadTenantContext(row.tenant_id);
      contexts.set(row.tenant_id, ctx);
    }
    if (ctx.blocked) {
      await note(row, null, `Lembrete não enviado: ${ctx.blocked}`);
      result.waiting++;
      continue;
    }

    const lead = await findLead(row);
    const params = {
      name: lead?.name || row.customer_name,
      property: row.property_label || 'combinado',
      scheduledAt,
      now: new Date(),
    };

    let lastInboundAt: Date | null = null;
    if (lead) {
      const { data: inbound } = await supabaseAdmin
        .from('chat_messages')
        .select('created_at')
        .eq('tenant_id', row.tenant_id)
        .eq('lead_id', lead.id)
        .eq('direction', 'INBOUND')
        .order('created_at', { ascending: false })
        .limit(1);
      lastInboundAt = inbound?.[0]?.created_at ? new Date(inbound[0].created_at) : null;
    }
    const useText = isInsideServiceWindow(lastInboundAt, new Date());
    if (!useText) {
      if (!ctx.template) ctx.template = await ensureVisitReminderTemplate(row.tenant_id);
      if (!ctx.template.ok) {
        // Modelo em análise: tenta de novo no próximo cron enquanto ainda der tempo.
        await note(row, null, `Cliente fora da janela de 24h. ${ctx.template.reason}`);
        result.waiting++;
        continue;
      }
    }

    // Claim atômico: com dois crons ao mesmo tempo, só um envia.
    const { data: claimed } = await supabaseAdmin
      .from('visit_requests')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id)
      .eq('status', 'CONFIRMED')
      .is('reminder_sent_at', null)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    if (lead?.opt_in === false) {
      await note(row, 'SKIPPED', 'O cliente pediu para não receber mensagens.');
      result.skipped++;
      continue;
    }

    const to = lead?.phone || row.customer_phone;
    let body: string;
    let sent: { success: boolean; messageId?: string; error?: unknown };
    try {
      if (useText) {
        body = visitReminderText(params);
        sent = await sendMetaText({ to, textBody: body, credentials: ctx.credentials! });
      } else {
        const tpl = ctx.template as Extract<TemplateState, { ok: true }>;
        body = renderVisitReminderTemplate(params);
        sent = await sendMetaTemplate({
          to,
          templateName: tpl.name,
          languageCode: tpl.language,
          credentials: ctx.credentials!,
          components: [{ type: 'body', parameters: visitReminderTemplateValues(params).map((text) => ({ type: 'text', text })) }],
        });
      }
    } catch (err) {
      await note(row, 'FAILED', err instanceof Error ? err.message : 'Erro ao enviar via Meta.');
      result.failed++;
      continue;
    }

    if (!sent.success || !sent.messageId) {
      logger.warn('visit_reminders.send_failed', { tenantId: row.tenant_id, error: formatMetaError(sent.error) });
      await note(row, 'FAILED', formatMetaError(sent.error));
      result.failed++;
      continue;
    }

    await note(row, 'SENT', 'Lembrete enviado ao cliente.');
    result.sent++;
    if (lead) {
      await supabaseAdmin.from('chat_messages').insert({
        tenant_id: row.tenant_id,
        lead_id: lead.id,
        direction: 'OUTBOUND',
        sender_type: 'AUTOMATION',
        message_type: useText ? 'TEXT' : 'TEMPLATE',
        body,
        wamid: sent.messageId,
        status: 'SENT',
      });
    }
  }

  return result;
}
