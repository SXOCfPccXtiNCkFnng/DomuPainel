/**
 * Envia os lembretes do agendamento para o cliente final (cron a cada 5 min).
 * Lembrete é mensagem de serviço: não conta no limite de disparos do plano
 * nem na cota da atendente — só exige assinatura ativa e número conectado.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import { requireVerifiedWhatsApp } from '@/lib/whatsappConnection';
import {
  createMetaMessageTemplate,
  fetchMetaTemplateStatus,
  formatMetaError,
  sendMetaTemplate,
  sendMetaText,
  type MetaCredentials,
} from '@/lib/metaClient';
import { phoneLookupVariants } from '@/lib/phone';
import { DEFAULT_SCHEDULING_SETTINGS } from '@/lib/scheduling';
import { loadSchedulingSettings } from '@/lib/schedulingServer';
import {
  dueReminder,
  isInsideServiceWindow,
  REMINDER_HOUR_MINUTES,
  REMINDER_TEMPLATE_BODY,
  REMINDER_TEMPLATE_PREFIX,
  reminderTemplateValues,
  reminderText,
  renderReminderTemplate,
  type ReminderKind,
  type ReminderSettings,
} from '@/lib/appointmentReminderRules';

type TemplateState =
  | { ok: true; name: string; language: string }
  | { ok: false; reason: string };

type TenantContext = {
  settings: ReminderSettings;
  blocked: string | null;
  credentials?: MetaCredentials;
  /** Carregado só quando algum cliente está fora da janela de 24h. */
  template?: TemplateState;
};

type DueAppointment = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  service_name: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  created_at: string | null;
  reminder_hour_at: string | null;
  reminder_soon_at: string | null;
};

export type ReminderRunResult = { checked: number; sent: number; failed: number; skipped: number; waiting: number };

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Garante o modelo do lembrete na Meta para a conta (criado uma vez, UTILITY).
 * Chamado ao salvar a agenda e, se faltar, pelo cron.
 */
export async function ensureReminderTemplate(tenantId: string): Promise<TemplateState> {
  const { data: row, error } = await supabaseAdmin
    .from('scheduling_settings')
    .select('reminder_template_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) {
    if (error.code === '42703') return { ok: false, reason: 'Lembretes ainda não ativados no banco (migration pendente).' };
    throw error;
  }

  if (row?.reminder_template_id) {
    const { data: tpl } = await supabaseAdmin
      .from('hsm_templates')
      .select('id, name, language, status, meta_template_id')
      .eq('id', row.reminder_template_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (tpl) {
      let status = tpl.status;
      if (status === 'PENDING' && tpl.meta_template_id) {
        const meta = await fetchMetaTemplateStatus(tenantId, tpl.meta_template_id);
        if (meta.ok && meta.status !== 'PENDING') {
          status = meta.status;
          await supabaseAdmin
            .from('hsm_templates')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', tpl.id)
            .eq('tenant_id', tenantId);
          if (status === 'REJECTED') {
            logger.warn('reminders.template_rejected', { tenantId, reason: meta.reason });
          }
        }
      }
      if (status === 'APPROVED') return { ok: true, name: tpl.name, language: tpl.language || 'pt_BR' };
      if (status === 'PENDING') return { ok: false, reason: 'Modelo do lembrete em análise na Meta.' };
      return { ok: false, reason: 'A Meta reprovou o modelo do lembrete.' };
    }
  }

  const name = `${REMINDER_TEMPLATE_PREFIX}${Date.now().toString(36)}`;
  const meta = await createMetaMessageTemplate({
    tenantId,
    name,
    category: 'UTILITY',
    language: 'pt_BR',
    bodyText: REMINDER_TEMPLATE_BODY,
  });
  if (!meta.success) {
    logger.warn('reminders.template_create_failed', { tenantId, message: meta.error });
    return { ok: false, reason: `Não foi possível criar o modelo do lembrete na Meta: ${meta.error || 'erro desconhecido'}.` };
  }

  const status = String(meta.status || 'PENDING').toUpperCase();
  const finalStatus = status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING';
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('hsm_templates')
    .insert({
      tenant_id: tenantId,
      name,
      category: 'UTILITY',
      language: 'pt_BR',
      status: finalStatus,
      meta_template_id: meta.metaTemplateId || null,
      header_type: 'NONE',
      body_text: REMINDER_TEMPLATE_BODY,
      variables: meta.variables || ['nome', 'servico', 'horario'],
    })
    .select('id')
    .single();
  if (insertError || !inserted) throw insertError || new Error('Falha ao salvar o modelo do lembrete.');

  // Conta que nunca salvou a agenda ainda não tem linha: cria com o padrão.
  const { error: linkError } = await supabaseAdmin.from('scheduling_settings').upsert(
    row
      ? { tenant_id: tenantId, reminder_template_id: inserted.id, updated_at: new Date().toISOString() }
      : { tenant_id: tenantId, ...DEFAULT_SCHEDULING_SETTINGS, reminder_template_id: inserted.id },
    { onConflict: 'tenant_id' }
  );
  if (linkError) throw linkError;

  logger.info('reminders.template_created', { tenantId, status: finalStatus });
  if (finalStatus === 'APPROVED') return { ok: true, name, language: 'pt_BR' };
  return { ok: false, reason: 'Modelo do lembrete em análise na Meta.' };
}

async function loadTenantContext(tenantId: string): Promise<TenantContext> {
  const [settings, { data: sub }] = await Promise.all([
    loadSchedulingSettings(tenantId),
    supabaseAdmin.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  const ctx: TenantContext = { settings, blocked: null };
  if (!isSubscriptionAllowedToDispatch(sub?.status)) {
    ctx.blocked = 'Assinatura inativa ou vencida.';
    return ctx;
  }
  const wa = await requireVerifiedWhatsApp(tenantId);
  if (!wa.ok) {
    ctx.blocked = wa.error;
    return ctx;
  }
  ctx.credentials = wa.credentials;
  return ctx;
}

async function findLead(row: DueAppointment) {
  const columns = 'id, name, phone, opt_in';
  if (row.lead_id) {
    const { data } = await supabaseAdmin
      .from('leads')
      .select(columns)
      .eq('id', row.lead_id)
      .eq('tenant_id', row.tenant_id)
      .maybeSingle();
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

export async function processDueReminders(options?: { limit?: number; deadlineMs?: number }): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { checked: 0, sent: 0, failed: 0, skipped: 0, waiting: 0 };
  const runDeadline = Date.now() + (options?.deadlineMs ?? 45_000);
  const now = new Date();

  const { data: due, error } = await supabaseAdmin
    .from('appointments')
    .select(
      'id, tenant_id, lead_id, service_name, customer_name, customer_phone, starts_at, created_at, reminder_hour_at, reminder_soon_at'
    )
    .eq('status', 'CONFIRMED')
    .gt('starts_at', now.toISOString())
    .lte('starts_at', new Date(now.getTime() + (REMINDER_HOUR_MINUTES + 1) * 60 * 1000).toISOString())
    .or('reminder_hour_at.is.null,reminder_soon_at.is.null')
    .order('starts_at', { ascending: true })
    .limit(options?.limit ?? 100);
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return result; // migration pendente
    throw error;
  }

  const contexts = new Map<string, TenantContext>();

  const finish = async (row: DueAppointment, status: 'SENT' | 'FAILED' | 'SKIPPED', note: string | null) => {
    await supabaseAdmin
      .from('appointments')
      .update({ reminder_status: status, reminder_note: note ? note.slice(0, 500) : null })
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id);
    if (status === 'SENT') result.sent++;
    else if (status === 'FAILED') result.failed++;
    else result.skipped++;
  };

  for (const row of (due || []) as DueAppointment[]) {
    if (Date.now() > runDeadline) break;

    let ctx = contexts.get(row.tenant_id);
    if (!ctx) {
      ctx = await loadTenantContext(row.tenant_id);
      contexts.set(row.tenant_id, ctx);
    }

    const kind: ReminderKind | null = dueReminder({
      startsAt: new Date(row.starts_at),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      now: new Date(),
      settings: ctx.settings,
      hourSentAt: row.reminder_hour_at ? new Date(row.reminder_hour_at) : null,
      soonSentAt: row.reminder_soon_at ? new Date(row.reminder_soon_at) : null,
    });
    if (!kind) continue;
    result.checked++;

    if (ctx.blocked) {
      // Assinatura/número: não adianta tentar a cada 5 min. Registra e segue.
      await supabaseAdmin
        .from('appointments')
        .update({ reminder_note: `Lembrete não enviado: ${ctx.blocked}`.slice(0, 500) })
        .eq('id', row.id)
        .eq('tenant_id', row.tenant_id);
      result.waiting++;
      continue;
    }

    const lead = await findLead(row);
    const params = {
      name: lead?.name || row.customer_name,
      service: row.service_name,
      time: timeFormatter.format(new Date(row.starts_at)),
    };

    // Texto livre só dentro da janela de 24h; fora dela, o modelo aprovado.
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
      if (!ctx.template) ctx.template = await ensureReminderTemplate(row.tenant_id);
      if (!ctx.template.ok) {
        // Modelo em análise: tenta de novo no próximo cron enquanto ainda der tempo.
        await supabaseAdmin
          .from('appointments')
          .update({ reminder_note: `Cliente fora da janela de 24h. ${ctx.template.reason}`.slice(0, 500) })
          .eq('id', row.id)
          .eq('tenant_id', row.tenant_id);
        result.waiting++;
        continue;
      }
    }

    // Claim atômico: com dois crons ao mesmo tempo, só um envia. O SOON
    // dispensa o HOUR que não saiu (não faz sentido lembrar "1h antes" depois).
    const claimedAt = new Date().toISOString();
    const column = kind === 'HOUR' ? 'reminder_hour_at' : 'reminder_soon_at';
    const patch: Record<string, string> = { [column]: claimedAt };
    if (kind === 'SOON' && !row.reminder_hour_at) patch.reminder_hour_at = claimedAt;
    const { data: claimed } = await supabaseAdmin
      .from('appointments')
      .update(patch)
      .eq('id', row.id)
      .eq('tenant_id', row.tenant_id)
      .eq('status', 'CONFIRMED')
      .is(column, null)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    if (lead?.opt_in === false) {
      await finish(row, 'SKIPPED', 'O cliente pediu para não receber mensagens.');
      continue;
    }

    const to = lead?.phone || row.customer_phone;
    let body: string;
    let sent: { success: boolean; messageId?: string; error?: unknown };
    try {
      if (useText) {
        body = reminderText(kind, params);
        sent = await sendMetaText({ to, textBody: body, credentials: ctx.credentials! });
      } else {
        const tpl = ctx.template as Extract<TemplateState, { ok: true }>;
        body = renderReminderTemplate(params);
        sent = await sendMetaTemplate({
          to,
          templateName: tpl.name,
          languageCode: tpl.language,
          credentials: ctx.credentials!,
          components: [
            {
              type: 'body',
              parameters: reminderTemplateValues(params).map((text) => ({ type: 'text', text })),
            },
          ],
        });
      }
    } catch (err) {
      await finish(row, 'FAILED', err instanceof Error ? err.message : 'Erro ao enviar via Meta.');
      continue;
    }

    if (!sent.success || !sent.messageId) {
      logger.warn('reminders.send_failed', { tenantId: row.tenant_id, kind, error: formatMetaError(sent.error) });
      await finish(row, 'FAILED', formatMetaError(sent.error));
      continue;
    }

    await finish(row, 'SENT', kind === 'HOUR' ? 'Lembrete de 1 hora enviado.' : 'Lembrete em cima da hora enviado.');
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
