import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    // 1. Fetch Campaigns for Tenant from Supabase
    let campaignQuery = supabaseAdmin
      .from('campaigns')
      .select('*, hsm_templates(name)');

    if (tenantId) {
      campaignQuery = campaignQuery.eq('tenant_id', tenantId);
    }

    const { data: campaigns } = await campaignQuery.order('created_at', { ascending: false });

    // 2. Fetch Leads Count
    let leadsQuery = supabaseAdmin.from('leads').select('*', { count: 'exact', head: true });
    if (tenantId) {
      leadsQuery = leadsQuery.eq('tenant_id', tenantId);
    }
    const { count: totalLeads } = await leadsQuery;

    // Calculate aggregated metrics from real database rows
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
        createdAt: new Date(c.created_at).toLocaleDateString('pt-BR')
      };
    });

    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';
    const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      reports: {
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        deliveryRate: `${deliveryRate}%`,
        readRate: `${readRate}%`,
        totalLeads: totalLeads || 0,
        campaigns: formattedCampaigns
      }
    });

  } catch (error: any) {
    console.error('[Reports API Error]', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
