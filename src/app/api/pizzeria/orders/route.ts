import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireRole } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { toStoredPhone } from '@/lib/phone';
import { brtDateKey, brtToUtc } from '@/lib/scheduling';
import {
  ACTIVE_STATUSES,
  canMoveTo,
  cleanText,
  isOpenAt,
  isOrderStatus,
  orderFromRow,
  parseMoney,
  priceOrder,
  timestampColumnFor,
  type Fulfillment,
  type OrderItemInput,
} from '@/lib/pizzeria';
import {
  createOrder,
  isPizzeriaSchemaMissing,
  loadMenu,
  loadPizzeriaSettings,
  notifyOrderStatus,
  PIZZERIA_MIGRATION_PENDING,
} from '@/lib/pizzeriaServer';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Quem trabalha no balcão também mexe nos pedidos. */
const ORDER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'BROKER', 'ATTENDANT'];

function migrationPending() {
  return NextResponse.json({ success: false, error: PIZZERIA_MIGRATION_PENDING }, { status: 503 });
}

/**
 * Quadro de pedidos: os em andamento + os finalizados/cancelados de hoje.
 * ?view=historico&days=7 traz o histórico (até 31 dias).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const params = new URL(req.url).searchParams;
    const now = new Date();

    if (params.get('view') === 'historico') {
      const days = Math.min(31, Math.max(1, Number(params.get('days')) || 7));
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date(now.getTime() - days * 86_400_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        if (isPizzeriaSchemaMissing(error)) return NextResponse.json({ success: true, available: false, error: PIZZERIA_MIGRATION_PENDING, orders: [] });
        throw error;
      }
      return NextResponse.json({ success: true, available: true, orders: (data || []).map((r) => orderFromRow(r as Record<string, unknown>)) });
    }

    // "Hoje" vai desde as 5h (Brasília): o movimento que passa da meia-noite continua no mesmo dia.
    const todayKey = brtDateKey(new Date(now.getTime() - 5 * 3_600_000));
    const dayStart = brtToUtc(todayKey, 5 * 60);
    const [activeRes, todayRes, settings] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: true })
        .limit(300),
      supabaseAdmin
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['ENTREGUE', 'CANCELADO'])
        .gte('created_at', dayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(300),
      loadPizzeriaSettings(tenantId),
    ]);
    const err = activeRes.error || todayRes.error;
    if (err) {
      if (isPizzeriaSchemaMissing(err)) return NextResponse.json({ success: true, available: false, error: PIZZERIA_MIGRATION_PENDING, orders: [] });
      throw err;
    }
    return NextResponse.json({
      success: true,
      available: true,
      orders: [...(activeRes.data || []), ...(todayRes.data || [])].map((r) => orderFromRow(r as Record<string, unknown>)),
      openNow: isOpenAt(now, settings.weekly_hours),
      settings: { delivery_eta_min: settings.delivery_eta_min, pickup_eta_min: settings.pickup_eta_min, notify_status: settings.notify_status },
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.orders.get', error);
  }
}

/** Pedido lançado pela equipe (telefone, balcão, iFood...). Já entra aceito, em preparo. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ORDER_ROLES);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = cleanText(body.customerName, 120);
    if (name.length < 2) return NextResponse.json({ success: false, error: 'Informe o nome do cliente.' }, { status: 400 });
    const phone = toStoredPhone(String(body.customerPhone ?? ''));
    if (!/^55\d{10,11}$/.test(phone)) return NextResponse.json({ success: false, error: 'Informe o WhatsApp do cliente com DDD.' }, { status: 400 });
    const fulfillment: Fulfillment = body.fulfillment === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA';
    const address = cleanText(body.address, 400) || null;
    if (fulfillment === 'ENTREGA' && !address) return NextResponse.json({ success: false, error: 'Informe o endereço da entrega.' }, { status: 400 });

    const [menu, settings] = await Promise.all([loadMenu(tenantId, { activeOnly: true }), loadPizzeriaSettings(tenantId)]);
    // No painel a equipe escolhe o bairro da lista; sem lista, a taxa única vale.
    const priced = priceOrder({
      menu,
      settings: { ...settings, min_order: 0 },
      items: (Array.isArray(body.items) ? body.items : []) as OrderItemInput[],
      fulfillment,
      area: body.area,
    });
    if (!priced.ok) return NextResponse.json({ success: false, error: priced.error }, { status: 400 });

    const change = parseMoney(body.changeFor);
    const order = await createOrder({
      tenantId,
      customerName: name,
      customerPhone: phone,
      priced: priced.order,
      fulfillment,
      address: fulfillment === 'ENTREGA' ? address : null,
      paymentMethod: cleanText(body.paymentMethod, 40) || null,
      changeFor: change !== 'invalid' && change != null && change > priced.order.total ? change : null,
      notes: cleanText(body.notes, 500) || null,
      source: 'PANEL',
      status: 'EM_PREPARO',
    });
    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    if (isPizzeriaSchemaMissing(error)) return migrationPending();
    return internalErrorResponse('api.pizzeria.orders.post', error);
  }
}

/** Muda o status: { id, status, cancelReason? }. Avisa o cliente no WhatsApp quando dá. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(req, ORDER_ROLES);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? '');
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Informe o pedido.' }, { status: 400 });
    if (!isOrderStatus(body.status)) return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    const status = body.status;

    const { data: row, error: loadError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (loadError) {
      if (isPizzeriaSchemaMissing(loadError)) return migrationPending();
      throw loadError;
    }
    if (!row) return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
    const current = orderFromRow(row as Record<string, unknown>);
    if (!canMoveTo(current.status, status, current.fulfillment)) {
      return NextResponse.json({ success: false, error: 'Esse pedido não pode ir para essa etapa.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    const column = timestampColumnFor(status);
    if (column) patch[column] = now;
    // Pulou o aceite (balcão): o aceite conta a partir de agora.
    if (status !== 'CANCELADO' && !current.accepted_at) patch.accepted_at = now;
    if (status === 'CANCELADO') patch.cancel_reason = cleanText(body.cancelReason, 200) || null;

    // Só atualiza se ninguém mexeu no meio (dois celulares no mesmo pedido).
    const { data: updated, error } = await supabaseAdmin
      .from('orders')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('status', current.status)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ success: false, error: 'O pedido mudou em outro aparelho. Atualize a tela.' }, { status: 409 });

    const order = orderFromRow(updated as Record<string, unknown>);
    const [{ data: tenant }, settings] = await Promise.all([
      supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      loadPizzeriaSettings(tenantId),
    ]);
    const notice = await notifyOrderStatus({ tenantId, order, status, settings, companyName: tenant?.name || 'pizzaria' });
    if (notice.note) {
      await supabaseAdmin.from('orders').update({ status_notice: notice.note.slice(0, 200) }).eq('id', id).eq('tenant_id', tenantId);
      order.status_notice = notice.note;
    }
    return NextResponse.json({ success: true, order, notified: notice.sent });
  } catch (error: unknown) {
    return internalErrorResponse('api.pizzeria.orders.patch', error);
  }
}
