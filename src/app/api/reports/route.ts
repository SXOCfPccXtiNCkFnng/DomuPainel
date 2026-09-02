import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    // 1. Fetch Campaigns for Tenant from Supabase
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*, hsm_templates(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // 2. Fetch Leads Count
    const { count: totalLeads } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

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
