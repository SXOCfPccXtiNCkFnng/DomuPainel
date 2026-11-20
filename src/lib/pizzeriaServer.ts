/**
 * Banco do módulo Pizzaria e Delivery: cardápio, configuração, pedidos e o
 * aviso de status para o cliente no WhatsApp.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { sendMetaText } from '@/lib/metaClient';
import { requireVerifiedWhatsApp } from '@/lib/whatsappConnection';
import { findOrCreateLeadId, isSchemaPendingError } from '@/lib/schedulingServer';
import { phoneLookupVariants, toStoredPhone } from '@/lib/phone';
import { ASSISTANT_SENDER_TYPE } from '@/lib/assistantRules';
import {
  insideServiceWindow,
  menuItemFromRow,
  orderFromRow,
  pizzeriaSettingsFromRow,
  sortMenu,
  statusMessage,
  type Fulfillment,
  type MenuItem,
  type Order,
  type OrderStatus,
  type PizzeriaSettings,
  type PricedOrder,
} from '@/lib/pizzeria';

export const PIZZERIA_MIGRATION_PENDING =
  'O módulo de pizzaria ainda não foi ativado no banco (migration 20261121_pizzeria.sql).';

export function isPizzeriaSchemaMissing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return isSchemaPendingError(error) || code === 'PGRST205' || code === 'PGRST204' || code === '42P01';
}

export async function loadPizzeriaSettings(tenantId: string): Promise<PizzeriaSettings> {
  const { data, error } = await supabaseAdmin.from('pizzeria_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (error) {
    if (isPizzeriaSchemaMissing(error)) return pizzeriaSettingsFromRow(null);
    throw error;
  }
  return pizzeriaSettingsFromRow(data as Record<string, unknown> | null);
}

export async function loadMenu(tenantId: string, opts?: { activeOnly?: boolean }): Promise<MenuItem[]> {
  let query = supabaseAdmin.from('menu_items').select('*').eq('tenant_id', tenantId).limit(1000);
  if (opts?.activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) {
    if (isPizzeriaSchemaMissing(error)) return [];
    throw error;
  }
  return sortMenu((data || []).map((row) => menuItemFromRow(row as Record<string, unknown>)));
}

export type CreateOrderInput = {
  tenantId: string;
  leadId?: string | null;
  customerName: string;
  customerPhone: string;
  priced: PricedOrder;
  fulfillment: Fulfillment;
  address: string | null;
  paymentMethod: string | null;
  changeFor: number | null;
  notes: string | null;
  source: 'WHATSAPP' | 'PANEL';
  status?: OrderStatus;
};

/** Grava o pedido com o próximo número da conta (tenta de novo se dois chegarem juntos). */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const leadId =
    input.leadId ?? (await findOrCreateLeadId(input.tenantId, input.customerName, input.customerPhone, 'PEDIDO'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await supabaseAdmin
      .from('orders')
      .select('order_number')
      .eq('tenant_id', input.tenantId)
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const orderNumber = Number(last?.order_number ?? 0) + 1;
    const now = new Date().toISOString();
    const status = input.status ?? 'NOVO';
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        tenant_id: input.tenantId,
        order_number: orderNumber,
        lead_id: leadId,
        customer_name: input.customerName.slice(0, 255),
        customer_phone: toStoredPhone(input.customerPhone),
        items: input.priced.lines,
        subtotal: input.priced.subtotal,
        delivery_fee: input.priced.delivery_fee,
        total: input.priced.total,
        fulfillment: input.fulfillment,
        address: input.address,
        area: input.priced.area,
        payment_method: input.paymentMethod,
        change_for: input.changeFor,
        notes: input.notes,
        status,
        source: input.source,
        ...(status === 'EM_PREPARO' ? { accepted_at: now } : {}),
      })
      .select('*')
      .single();
    if (!error) return orderFromRow(data as Record<string, unknown>);
    if (error.code !== '23505') throw error;
  }
  throw new Error('Não foi possível numerar o pedido. Tente de novo.');
}

/** Pedidos recentes de um cliente (a atendente consulta o status). */
export async function loadCustomerOrders(tenantId: string, phone: string, limit = 3): Promise<Order[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('customer_phone', phoneLookupVariants(phone))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isPizzeriaSchemaMissing(error)) return [];
    throw error;
  }
  return (data || []).map((row) => orderFromRow(row as Record<string, unknown>));
}

/**
 * Avisa o cliente da mudança de status pelo WhatsApp. Só manda texto livre
 * dentro da janela de 24h da Meta (o cliente escreveu nas últimas 24h) —
 * fora dela a Meta recusa. Devolve o que aconteceu, para mostrar no quadro.
 */
export async function notifyOrderStatus(params: {
  tenantId: string;
  order: Order;
  status: OrderStatus;
  settings: PizzeriaSettings;
  companyName: string;
}): Promise<{ sent: boolean; note: string }> {
  const { tenantId, order, status, settings } = params;
  if (!settings.notify_status) return { sent: false, note: 'Aviso ao cliente desligado' };
  const text = statusMessage({
    status,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    fulfillment: order.fulfillment,
    etaMinutes: order.fulfillment === 'ENTREGA' ? settings.delivery_eta_min : settings.pickup_eta_min,
    companyName: params.companyName,
    cancelReason: order.cancel_reason,
  });
  if (!text) return { sent: false, note: '' };

  let lastInbound: Date | null = null;
  if (order.lead_id) {
    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('lead_id', order.lead_id)
      .eq('direction', 'INBOUND')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastInbound = data?.created_at ? new Date(data.created_at) : null;
  }
  if (!insideServiceWindow(lastInbound, new Date())) {
    return { sent: false, note: 'Cliente sem conversa nas últimas 24h: avise pelo celular' };
  }

  const wa = await requireVerifiedWhatsApp(tenantId);
  if (!wa.ok) return { sent: false, note: 'WhatsApp desconectado' };
  try {
    const sent = await sendMetaText({ to: order.customer_phone, textBody: text, credentials: wa.credentials });
    if (!sent.success || !sent.messageId) {
      logger.warn('pizzeria.status_notify_failed', { tenantId, orderId: order.id, error: sent.error });
      return { sent: false, note: 'Não foi possível avisar o cliente' };
    }
    if (order.lead_id) {
      await supabaseAdmin.from('chat_messages').insert({
        tenant_id: tenantId,
        lead_id: order.lead_id,
        direction: 'OUTBOUND',
        sender_type: ASSISTANT_SENDER_TYPE,
        message_type: 'TEXT',
        body: text,
        wamid: sent.messageId,
        status: 'SENT',
      });
    }
    return { sent: true, note: 'Cliente avisado no WhatsApp' };
  } catch (err) {
    logger.warn('pizzeria.status_notify_error', { tenantId, message: err instanceof Error ? err.message : String(err) });
    return { sent: false, note: 'Não foi possível avisar o cliente' };
  }
}

/** Pedidos desde uma data, em páginas (o PostgREST devolve até 1000 por vez). */
export async function loadOrdersSince(tenantId: string, since: Date, max = 20_000): Promise<Order[]> {
  const rows: Order[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error) {
      if (isPizzeriaSchemaMissing(error)) return rows;
      throw error;
    }
    rows.push(...(data || []).map((row) => orderFromRow(row as Record<string, unknown>)));
    if ((data || []).length < 1000) break;
  }
  return rows;
}
