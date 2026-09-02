import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

type Period = 'today' | '7d' | '30d' | '90d';

function periodDays(period: Period): number {
  if (period === 'today') return 1;
  if (period === '7d') return 7;
  if (period === '90d') return 90;
  return 30;
}

function pctChange(current: number, previous: number): number | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function sumCampaigns(
  campaigns: Array<{
    sent_count?: number;
    delivered_count?: number;
    read_count?: number;
    failed_count?: number;
    created_at?: string;
  }>,
  from: Date,
  to: Date
) {
  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;

  campaigns.forEach((c) => {
    const created = c.created_at ? new Date(c.created_at).getTime() : 0;
    if (created < from.getTime() || created >= to.getTime()) return;
    sent += c.sent_count || 0;
    delivered += c.delivered_count || 0;
    read += c.read_count || 0;
    failed += c.failed_count || 0;
  });

  return { sent, delivered, read, failed };
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') as Period) || '30d';
    const days = periodDays(period);

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', tenantId);

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setHours(0, 0, 0, 0);
    if (period !== 'today') {
      currentStart.setDate(currentStart.getDate() - (days - 1));
    }
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);
    const previousEnd = new Date(currentStart);

    const allCampaigns = campaigns || [];
    const current = sumCampaigns(allCampaigns, currentStart, now);
    const previous = sumCampaigns(allCampaigns, previousStart, previousEnd);

    // Totais acumulados (cards principais usam o recorte do período)
    const totalDispatches = current.sent;
    const deliveredCount = current.delivered;
    const readCount = current.read;
    const failedCount = current.failed;

    const deliveryRateNum =
      totalDispatches > 0 ? (deliveredCount / totalDispatches) * 100 : 0;
    const prevDeliveryRateNum =
      previous.sent > 0 ? (previous.delivered / previous.sent) * 100 : 0;

    let leadsCurrent = 0;
    let leadsPrevious = 0;
    let leadsTotal = 0;
    let qualified = 0;
    let visitas = 0;

    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('id, status, created_at')
      .eq('tenant_id', tenantId);

    const list = leads || [];
    leadsTotal = list.length;
    qualified = list.filter((l) =>
      ['QUALIFIED', 'EM_ATENDIMENTO', 'VISITA_AGENDADA', 'PROPOSTA', 'FECHADO'].includes(
        l.status || ''
      )
    ).length;
    visitas = list.filter((l) => l.status === 'VISITA_AGENDADA').length;

    list.forEach((l) => {
      const created = l.created_at ? new Date(l.created_at).getTime() : 0;
      if (created >= currentStart.getTime() && created < now.getTime()) leadsCurrent += 1;
      if (created >= previousStart.getTime() && created < previousEnd.getTime()) {
        leadsPrevious += 1;
      }
    });

    const responseRate =
      totalDispatches > 0 ? Math.round((qualified / totalDispatches) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      metrics: {
        period,
        totalDispatches,
        deliveryRate: `${deliveryRateNum.toFixed(1)}%`,
        deliveryRateValue: deliveryRateNum,
        totalLeads: leadsTotal,
        leadsInPeriod: leadsCurrent,
        readCount,
        failedCount,
        whatsappStatus: tenant?.coexistence_status || 'CONNECTED',
        whatsappPhone: tenant?.whatsapp_number || 'Não cadastrado',
        tenantName: tenant?.name || 'Sua Empresa',
        segment: tenant?.segment || 'geral',
        campaignsCount: allCampaigns.length,
        // ROI strip
        atingidos: deliveredCount || totalDispatches,
        taxaResposta: responseRate,
        leadsQualificados: qualified,
        visitasAgendadas: visitas,
        // Deltas vs período anterior (null = sem base para comparar)
        trends: {
          dispatches: pctChange(current.sent, previous.sent),
          deliveryRate: pctChange(deliveryRateNum, prevDeliveryRateNum),
          conversations: pctChange(current.read, previous.read),
          contacts: pctChange(leadsCurrent, leadsPrevious),
        },
      },
    });
  } catch (error: any) {
    console.error('[Dashboard Stats API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
