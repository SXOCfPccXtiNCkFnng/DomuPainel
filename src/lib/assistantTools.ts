/**
 * Ferramentas que a IA do WhatsApp pode chamar. Tudo é conferido aqui no
 * servidor: a IA só enxerga e mexe nos agendamentos do contato da conversa,
 * e só marca horário livre dentro das regras da agenda.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { notifyTenantAdmins } from '@/lib/notify';
import { appBaseUrl, sendEmail } from '@/lib/email';
import { brandedEmailHtml, escapeHtml } from '@/lib/emailTemplates';
import { formatPhoneBR } from '@/lib/validators';
import { HUMAN_PAUSE_MS, resolveService } from '@/lib/assistantRules';
import {
  addDaysToKey,
  availableSlots,
  brtDateKey,
  brtDayRange,
  brtMinutesOfDay,
  brtToUtc,
  brtWeekday,
  formatDuration,
  formatMinutes,
  isValidDateKey,
  parseTime,
  WEEKDAY_LABELS,
  type SchedulingSettings,
  type ServiceItem,
} from '@/lib/scheduling';
import { createAppointment, loadBusyRanges } from '@/lib/schedulingServer';
import { phoneLookupVariants } from '@/lib/phone';

/**
 * Agendamentos deste cliente: os ligados ao contato e os marcados pelo painel
 * sem contato vinculado, com o mesmo telefone deste WhatsApp.
 */
function ownAppointmentsFilter(ctx: AssistantToolContext): string {
  const phones = phoneLookupVariants(ctx.leadPhone).filter((p) => /^\d+$/.test(p));
  const byPhone = phones.length ? `,and(lead_id.is.null,customer_phone.in.(${phones.join(',')}))` : '';
  return `lead_id.eq.${ctx.leadId}${byPhone}`;
}

export type AssistantToolContext = {
  tenantId: string;
  leadId: string;
  leadPhone: string;
  leadName: string;
  companyName: string;
  lastCustomerMessage: string;
  services: ServiceItem[];
  scheduling: SchedulingSettings;
  now: Date;
};

const STRING = 'STRING';

/** Declarações no formato do Gemini (function calling). */
export const ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: 'consultar_horarios_livres',
    description:
      'Lista os horários livres de um dia para um serviço. Use sempre antes de oferecer horários ao cliente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        servico: { type: STRING, description: 'Nome do serviço, como está na lista de serviços.' },
        data: { type: STRING, description: 'Dia no formato AAAA-MM-DD.' },
      },
      required: ['servico', 'data'],
    },
  },
  {
    name: 'agendar',
    description:
      'Marca o horário. Só use depois que o cliente confirmar o resumo (serviço, dia, horário e carro).',
    parameters: {
      type: 'OBJECT',
      properties: {
        servico: { type: STRING, description: 'Nome do serviço.' },
        data: { type: STRING, description: 'Dia no formato AAAA-MM-DD.' },
        horario: { type: STRING, description: 'Horário de início no formato HH:MM, um dos horários livres.' },
        nome_cliente: { type: STRING, description: 'Nome do cliente.' },
        veiculo: { type: STRING, description: 'Modelo do carro (e placa/cor, se o cliente disse).' },
        observacoes: { type: STRING, description: 'Observações do cliente, se houver.' },
      },
      required: ['servico', 'data', 'horario', 'nome_cliente', 'veiculo'],
    },
  },
  {
    name: 'ver_agendamentos_do_cliente',
    description: 'Lista os próximos agendamentos deste cliente (para remarcar, cancelar ou confirmar).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'cancelar_agendamento',
    description:
      'Cancela um agendamento deste cliente. Só use depois que o cliente confirmar qual agendamento quer cancelar. Use o id retornado por ver_agendamentos_do_cliente.',
    parameters: {
      type: 'OBJECT',
      properties: { agendamento_id: { type: STRING, description: 'Id do agendamento.' } },
      required: ['agendamento_id'],
    },
  },
  {
    name: 'chamar_equipe',
    description:
      'Avisa a equipe para assumir a conversa (reclamação, pedido para falar com uma pessoa, algo que você não resolve). Depois disso você para de responder esta conversa.',
    parameters: {
      type: 'OBJECT',
      properties: { motivo: { type: STRING, description: 'Resumo curto do motivo, em português.' } },
      required: ['motivo'],
    },
  },
];

type ToolResult = Record<string, unknown>;

const timeOf = (iso: string | Date) => formatMinutes(brtMinutesOfDay(new Date(iso)));
const weekdayOf = (dateKey: string) => WEEKDAY_LABELS[brtWeekday(dateKey)].toLowerCase();
/** "sábado 24/10 às 09:00" — para as notificações da equipe. */
const whenOf = (iso: string) => {
  const key = brtDateKey(new Date(iso));
  const [, month, day] = key.split('-');
  return `${weekdayOf(key)} ${day}/${month} às ${timeOf(iso)}`;
};

async function freeSlots(ctx: AssistantToolContext, service: ServiceItem, dateKey: string): Promise<Date[]> {
  const { start, end } = brtDayRange(dateKey);
  const busy = await loadBusyRanges(ctx.tenantId, start, end);
  return availableSlots({
    dateKey,
    durationMinutes: service.duration_minutes,
    settings: ctx.scheduling,
    busy,
    now: ctx.now,
  });
}

async function consultarHorarios(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<ToolResult> {
  const match = resolveService(ctx.services, args.servico);
  if (!match.ok) return { erro: 'Serviço não encontrado.', servicos_disponiveis: match.options };
  const dateKey = String(args.data ?? '');
  if (!isValidDateKey(dateKey)) return { erro: 'Data inválida; use AAAA-MM-DD.' };

  const service = match.service;
  const slots = await freeSlots(ctx, service, dateKey);
  const result: ToolResult = {
    servico: service.name,
    duracao: formatDuration(service.duration_minutes),
    data: dateKey,
    dia_da_semana: weekdayOf(dateKey),
    horarios_livres: slots.slice(0, 40).map(timeOf),
  };

  if (!slots.length) {
    const todayKey = brtDateKey(ctx.now);
    const lastKey = addDaysToKey(todayKey, ctx.scheduling.booking_horizon_days);
    const nextDays: { data: string; dia_da_semana: string; primeiro_horario: string }[] = [];
    for (let key = addDaysToKey(dateKey, 1); key <= lastKey && nextDays.length < 3; key = addDaysToKey(key, 1)) {
      const next = await freeSlots(ctx, service, key);
      if (next.length) nextDays.push({ data: key, dia_da_semana: weekdayOf(key), primeiro_horario: timeOf(next[0]) });
    }
    result.observacao = 'Sem horário livre neste dia.';
    result.proximos_dias_com_horario = nextDays;
  }
  return result;
}

async function agendar(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<ToolResult> {
  const match = resolveService(ctx.services, args.servico);
  if (!match.ok) return { ok: false, erro: 'Serviço não encontrado.', servicos_disponiveis: match.options };
  const dateKey = String(args.data ?? '');
  const minutes = parseTime(args.horario);
  if (!isValidDateKey(dateKey) || minutes == null) return { ok: false, erro: 'Data ou horário inválido.' };

  const result = await createAppointment(
    ctx.tenantId,
    {
      serviceId: match.service.id,
      startsAt: brtToUtc(dateKey, minutes).toISOString(),
      customerName: args.nome_cliente || ctx.leadName,
      customerPhone: ctx.leadPhone,
      vehicle: args.veiculo,
      notes: args.observacoes,
      leadId: ctx.leadId,
    },
    'WHATSAPP'
  );
  if (!result.ok) return { ok: false, erro: result.error };

  const a = result.appointment;
  await notifyTenantAdmins(ctx.tenantId, {
    title: 'Novo agendamento pelo WhatsApp',
    message: `${a.customer_name} · ${a.service_name} · ${whenOf(a.starts_at)}${a.vehicle ? ` · ${a.vehicle}` : ''}`,
    type: 'SUCCESS',
    url: '/agenda',
  });
  return {
    ok: true,
    agendamento: {
      id: a.id,
      servico: a.service_name,
      data: brtDateKey(new Date(a.starts_at)),
      dia_da_semana: weekdayOf(brtDateKey(new Date(a.starts_at))),
      horario: timeOf(a.starts_at),
      previsao_de_termino: timeOf(a.ends_at),
      veiculo: a.vehicle,
    },
  };
}

async function verAgendamentos(ctx: AssistantToolContext): Promise<ToolResult> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('id, service_name, starts_at, vehicle')
    .eq('tenant_id', ctx.tenantId)
    .or(ownAppointmentsFilter(ctx))
    .eq('status', 'CONFIRMED')
    .gte('starts_at', ctx.now.toISOString())
    .order('starts_at', { ascending: true })
    .limit(5);
  if (error) throw error;
  return {
    agendamentos: (data || []).map((a) => {
      const key = brtDateKey(new Date(a.starts_at));
      return {
        id: a.id,
        servico: a.service_name,
        data: key,
        dia_da_semana: weekdayOf(key),
        horario: timeOf(a.starts_at),
        veiculo: a.vehicle,
      };
    }),
  };
}

async function cancelarAgendamento(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<ToolResult> {
  const id = String(args.agendamento_id ?? '');
  if (!id) return { ok: false, erro: 'Informe o agendamento.' };
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .or(ownAppointmentsFilter(ctx))
    .eq('status', 'CONFIRMED')
    .gte('starts_at', ctx.now.toISOString())
    .select('id, customer_name, service_name, starts_at');
  if (error) {
    if (error.code === '22P02') return { ok: false, erro: 'Agendamento não encontrado.' };
    throw error;
  }
  if (!data?.length) return { ok: false, erro: 'Agendamento não encontrado ou já passou.' };
  logger.info('assistant.appointment_cancelled', { tenantId: ctx.tenantId, appointmentId: id });
  const c = data[0];
  await notifyTenantAdmins(ctx.tenantId, {
    title: 'Agendamento cancelado pelo WhatsApp',
    message: `${c.customer_name} · ${c.service_name} · ${whenOf(c.starts_at)}`,
    type: 'INFO',
    url: '/agenda',
  });
  return { ok: true };
}

async function chamarEquipe(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<ToolResult> {
  const reason = String(args.motivo ?? '').trim().slice(0, 300) || 'Cliente precisa de atendimento';
  const pausedUntil = new Date(ctx.now.getTime() + HUMAN_PAUSE_MS);

  await supabaseAdmin
    .from('leads')
    .update({ assistant_paused_until: pausedUntil.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', ctx.leadId)
    .eq('tenant_id', ctx.tenantId);

  const phone = formatPhoneBR(ctx.leadPhone) || ctx.leadPhone;
  const title = `${ctx.leadName} precisa de atendimento`;
  const message = `${reason}. WhatsApp: ${phone}. A atendente parou de responder essa conversa por 12 horas; responda pelo WhatsApp Business.`;
  await notifyTenantAdmins(ctx.tenantId, { title, message, type: 'WARNING', url: '/atendente' });

  const { data: admins } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('tenant_id', ctx.tenantId)
    .eq('role', 'ADMIN');
  const bodyHtml = `<p><strong>${escapeHtml(ctx.leadName)}</strong> (${escapeHtml(phone)}) precisa de alguém da equipe.</p>
<p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
<p><strong>Última mensagem:</strong> “${escapeHtml(ctx.lastCustomerMessage.slice(0, 300))}”</p>
<p>A atendente parou de responder essa conversa por 12 horas. Responda pelo WhatsApp Business do celular.</p>`;
  await Promise.all(
    (admins || [])
      .filter((a) => a.email)
      .map((a) =>
        sendEmail({
          to: a.email,
          subject: `${ctx.companyName}: ${title}`,
          html: brandedEmailHtml({ heading: title, bodyHtml, ctaLabel: 'Abrir o painel', ctaUrl: appBaseUrl() }),
          text: `${title}\n\nMotivo: ${reason}\nWhatsApp: ${phone}\nÚltima mensagem: "${ctx.lastCustomerMessage.slice(0, 300)}"\n\nA atendente parou de responder essa conversa por 12 horas. Responda pelo WhatsApp Business do celular.`,
        })
      )
  );

  logger.info('assistant.handoff', { tenantId: ctx.tenantId, leadId: ctx.leadId });
  return { ok: true, observacao: 'Equipe avisada. Diga ao cliente que alguém vai responder em breve.' };
}

export async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AssistantToolContext
): Promise<ToolResult> {
  switch (name) {
    case 'consultar_horarios_livres':
      return consultarHorarios(args, ctx);
    case 'agendar':
      return agendar(args, ctx);
    case 'ver_agendamentos_do_cliente':
      return verAgendamentos(ctx);
    case 'cancelar_agendamento':
      return cancelarAgendamento(args, ctx);
    case 'chamar_equipe':
      return chamarEquipe(args, ctx);
    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}
