import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { recountCampaignLogs } from '@/lib/campaignDispatch';

export const dynamic = 'force-dynamic';

function statusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === 'PENDING') return 'Na fila';
  if (s === 'SENT') return 'Enviado';
  if (s === 'DELIVERED') return 'Entregue';
  if (s === 'READ') return 'Lido';
  if (s === 'FAILED') return 'Falhou';
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const campaignId = params.id;

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

    const { data: logs } = await supabaseAdmin
      .from('campaign_logs')
      .select(
        'id, status, error_message, sent_at, delivered_at, read_at, created_at, wamid, leads(name, phone)'
      )
      .eq('campaign_id', campaignId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(12);

    const total =
      campaign.total_leads ||
      counts.pending + counts.sent + counts.delivered + counts.read + counts.failed;
    const done = counts.sent + counts.delivered + counts.read + counts.failed;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    const scheduledAt = campaign.scheduled_at ? new Date(campaign.scheduled_at).getTime() : null;
    const waitingSchedule =
      String(campaign.status).toUpperCase() === 'SCHEDULED' &&
      scheduledAt != null &&
      scheduledAt > Date.now();

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
        counts: {
          pending: counts.pending,
          sent: counts.sent,
          delivered: counts.delivered,
          read: counts.read,
          failed: counts.failed,
          sentTotal: counts.sent + counts.delivered + counts.read,
          deliveredTotal: counts.delivered + counts.read,
          readTotal: counts.read,
        },
        progressPct,
      },
      logs: (logs || []).map((log: any) => ({
        id: log.id,
        status: log.status,
        statusLabel: statusLabel(log.status || ''),
        errorMessage: log.error_message,
        recipientName: log.leads?.name || 'Contato',
        recipientPhone: log.leads?.phone || '—',
        wamid: log.wamid,
        sentAt: log.sent_at,
        deliveredAt: log.delivered_at,
        readAt: log.read_at,
        createdAt: log.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Campaign progress]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
