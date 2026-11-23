import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { logger } from '@/lib/logger';
import { loadSalesChat, loadSalesMonitor, setSalesLeadAssistant, type SalesLeadAction } from '@/lib/salesMonitor';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIODS = [7, 30, 90];
const ACTIONS: SalesLeadAction[] = ['pause', 'resume', 'disable', 'enable'];

/** Aba Vendedora: conversas e funil (?days=7|30|90) ou a conversa de um contato (?leadId=). */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const params = new URL(req.url).searchParams;
    const leadId = params.get('leadId');
    if (leadId) {
      if (!UUID_RE.test(leadId)) return NextResponse.json({ success: false, error: 'Contato inválido.' }, { status: 400 });
      const chat = await loadSalesChat(leadId);
      return NextResponse.json({ success: true, chat });
    }
    const requested = Number(params.get('days'));
    const days = PERIODS.includes(requested) ? requested : 30;
    return NextResponse.json({ success: true, ...(await loadSalesMonitor(days)) });
  } catch (error) {
    logger.error('interno.sales_failed', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Não foi possível carregar as conversas.' }, { status: 500 });
  }
}

/** Pausar, devolver para a vendedora, ou desligar/ligar a vendedora num contato. */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as { leadId?: unknown; action?: unknown };
    const leadId = String(body.leadId || '');
    const action = String(body.action || '') as SalesLeadAction;
    if (!UUID_RE.test(leadId) || !ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
    }
    const result = await setSalesLeadAssistant(leadId, action);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    logger.info('interno.sales_lead_action', { leadId, action, by: gate.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('interno.sales_action_failed', { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Não foi possível aplicar.' }, { status: 500 });
  }
}
