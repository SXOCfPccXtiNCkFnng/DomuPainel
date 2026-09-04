import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { periodStartDate, type PeriodKey } from '@/lib/period';

export const dynamic = 'force-dynamic';

type DailyPoint = {
  date: string;
  disparos: number;
  percentage: number;
};

/** Série diária real de disparos/entregas, a partir dos logs de envio (campaign_logs.sent_at). */
function buildDailySeries(
  logs: Array<{ sent_at: string | null; delivered_at: string | null }>,
  start: Date,
  end: Date
): DailyPoint[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const byDay = new Map<string, { sent: number; delivered: number }>();

  for (const log of logs) {
    if (!log.sent_at) continue;
    const key = log.sent_at.slice(0, 10);
    const bucket = byDay.get(key) || { sent: 0, delivered: 0 };
    bucket.sent += 1;
    if (log.delivered_at) bucket.delivered += 1;
    byDay.set(key, bucket);
  }

  const points: DailyPoint[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDay.get(key) || { sent: 0, delivered: 0 };
    points.push({
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      disparos: bucket.sent,
      percentage: bucket.sent > 0 ? Math.round((bucket.delivered / bucket.sent) * 100) : 0,
    });
  }
  return points;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') as PeriodKey) || '30d';
    const start = periodStartDate(period);
    const now = new Date();

    // 1. Campanhas do período (KPIs + tabela)
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*, hsm_templates(name)')
      .eq('tenant_id', tenantId)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false });

    // 2. Base total de contatos (não filtrada por período — é o total atual da carteira)
    const { count: totalLeads } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // 3. Logs de envio no período, para a série diária real do gráfico
    const { data: logs } = await supabaseAdmin
      .from('campaign_logs')
      .select('sent_at, delivered_at')
      .eq('tenant_id', tenantId)
      .gte('sent_at', start.toISOString())
      .not('sent_at', 'is', null)
      .limit(20000);

    let totalSent = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalFailed = 0;

    const formattedCampaigns = (campaigns || []).map((c) => {
      totalSent += c.sent_count || 0;
      totalDelivered += c.delivered_count || 0;
      totalRead += c.read_count || 0;
      totalFailed += c.failed_count || 0;

      return {
        id: c.id,
        name: c.name,
        templateName: c.hsm_templates?.name || 'Modelo de Disparo',
        segment: c.segment || 'geral',
        sentCount: c.sent_count || 0,
        deliveredCount: c.delivered_count || 0,
        readCount: c.read_count || 0,
        failedCount: c.failed_count || 0,
        status: c.status || 'COMPLETED',
        createdAt: new Date(c.created_at).toLocaleDateString('pt-BR'),
      };
    });

    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';
    const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      reports: {
        period,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        deliveryRate: `${deliveryRate}%`,
        readRate: `${readRate}%`,
        totalLeads: totalLeads || 0,
        campaigns: formattedCampaigns,
        series: buildDailySeries(logs || [], start, now),
      },
    });
  } catch (error: any) {
    console.error('[Reports API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
