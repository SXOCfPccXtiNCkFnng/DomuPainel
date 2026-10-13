import { NextRequest, NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { recountCampaignLogs } from '@/lib/campaignDispatch';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/** Filtros da lista de destinatários → status no banco. */
const STATUS_FILTERS: Record<string, string[]> = {
  sent: ['SENT'],
  delivered: ['DELIVERED'],
  read: ['READ'],
  failed: ['FAILED'],
  pending: ['PENDING', 'SENDING'],
};

function statusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === 'PENDING') return 'Na fila';
  if (s === 'SENDING') return 'Enviando';
  if (s === 'SENT') return 'Enviado';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'READ') return 'Lido';
  if (s === 'FAILED') return 'Falhou';
  return s;
}

const TERMINAL = new Set(['COMPLETED', 'FAILED']);

/**
 * Progresso de uma campanha: totais, lista de destinatários (paginada, com
 * filtro de situação e busca) e o resumo das falhas agrupado pelo motivo.
 * Query: ?status=all|sent|delivered|read|failed|pending&page=1&q=texto
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const { id: campaignId } = await params;
    const search = new URL(req.url).searchParams;
    const statusFilter = STATUS_FILTERS[search.get('status') || ''] || null;
    const page = Math.max(1, Number(search.get('page')) || 1);
    const q = (search.get('q') || '').trim();

    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select(
        'id, name, status, scheduled_at, started_at, completed_at, total_leads, sent_count, delivered_count, read_count, failed_count, hsm_templates(name)'
      )
      .eq('id', campaignId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campanha não encontrada.' }, { status: 404 });
    }

    const counts = await recountCampaignLogs(campaignId, tenantId);
    const fromLogs = {
      pending: counts.pending,
      sentTotal: counts.sent + counts.delivered + counts.read,
      deliveredTotal: counts.delivered + counts.read,
      readTotal: counts.read,
      failed: counts.failed,
    };

    // Campanhas antigas perderam envios quando o contato era excluído (antes da
    // migration de histórico). Encerrada: os totais salvos na campanha valem.
    const status = String(campaign.status || '').toUpperCase();
    const stored = {
      sentTotal: Number(campaign.sent_count) || 0,
      deliveredTotal: Number(campaign.delivered_count) || 0,
      readTotal: Number(campaign.read_count) || 0,
      failed: Number(campaign.failed_count) || 0,
    };
    const useStored =
      TERMINAL.has(status) && stored.sentTotal + stored.failed > fromLogs.sentTotal + fromLogs.failed;
    const summary = useStored ? { ...stored, pending: 0 } : fromLogs;
    const missingRecipients = useStored
      ? stored.sentTotal + stored.failed - (fromLogs.sentTotal + fromLogs.failed)
      : 0;

    const total = campaign.total_leads || summary.pending + summary.sentTotal + summary.failed;
    const done = summary.sentTotal + summary.failed;
    const progressPct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    // Lista de destinatários.
    const buildList = (withSnapshot: boolean) => {
      let query = supabaseAdmin
        .from('campaign_logs')
        .select(
          withSnapshot
            ? 'id, status, error_message, sent_at, delivered_at, read_at, created_at, recipient_name, recipient_phone, leads(name, phone)'
            : 'id, status, error_message, sent_at, delivered_at, read_at, created_at, leads(name, phone)',
          { count: 'exact' }
        )
        .eq('campaign_id', campaignId)
        .eq('tenant_id', tenantId);
      if (statusFilter) query = query.in('status', statusFilter);
      if (q && withSnapshot) {
        const safe = q.replace(/[%,()]/g, ' ');
        query = query.or(`recipient_name.ilike.%${safe}%,recipient_phone.ilike.%${safe.replace(/\D/g, '') || safe}%`);
      }
      return query
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    };
    let list = await buildList(true);
    // Migration do histórico ainda não aplicada: lista sem nome/telefone salvos.
    if (list.error?.code === '42703') list = await buildList(false);
    if (list.error) throw list.error;

    // Falhas agrupadas pelo motivo (o que o usuário precisa resolver).
    const { data: failedRows } = await supabaseAdmin
      .from('campaign_logs')
      .select('error_message')
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId)
      .eq('status', 'FAILED')
      .limit(5000);
    const reasons = new Map<string, number>();
    for (const row of failedRows || []) {
      const reason = String(row.error_message || 'Falha sem detalhe da Meta.');
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }

    const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at).getTime() : null;
    const waitingSchedule = status === 'SCHEDULED' && scheduledAt != null && scheduledAt > Date.now();

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        templateName: (campaign as any).hsm_templates?.name || null,
        scheduledAt: campaign.scheduled_at,
        startedAt: campaign.started_at,
        completedAt: campaign.completed_at,
        totalLeads: total,
        waitingSchedule,
        counts: summary,
        progressPct,
        missingRecipients,
      },
      failureReasons: [...reasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      recipients: (list.data || []).map((log: any) => ({
        id: log.id,
        status: log.status,
        statusLabel: statusLabel(log.status || ''),
        errorMessage: log.error_message,
        name: log.recipient_name || log.leads?.name || 'Contato excluído',
        phone: log.recipient_phone || log.leads?.phone || '',
        sentAt: log.sent_at,
        deliveredAt: log.delivered_at,
        readAt: log.read_at,
        createdAt: log.created_at,
      })),
      recipientsTotal: list.count || 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error: any) {
    console.error('[Campaign progress]', error);
    return internalErrorResponse('api.campaigns.progress', error);
  }
}
