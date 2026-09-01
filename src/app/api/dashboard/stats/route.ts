import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    // 1. Fetch Tenant Details
    let tenant = null;
    if (tenantId) {
      const { data } = await supabaseAdmin.from('tenants').select('*').eq('id', tenantId).single();
      tenant = data;
    }

    if (!tenant) {
      const { data } = await supabaseAdmin.from('tenants').select('*').limit(1);
      if (data && data.length > 0) tenant = data[0];
    }

    // 2. Fetch Campaigns from Supabase for this Tenant
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', tenant?.id || '');

    let totalDispatches = 0;
    let deliveredCount = 0;
    let readCount = 0;
    let failedCount = 0;

    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((c) => {
        totalDispatches += c.sent_count || 0;
        deliveredCount += c.delivered_count || 0;
        readCount += c.read_count || 0;
        failedCount += c.failed_count || 0;
      });
    }

    // 3. Fetch Leads Count from Supabase
    let leadsCount = 0;
    if (tenant?.id) {
      const { count } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      leadsCount = count || 0;
    } else {
      const { count } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true });
      leadsCount = count || 0;
    }

    // 4. Calculate Delivery Rate
    const deliveryRate = totalDispatches > 0 
      ? ((deliveredCount / totalDispatches) * 100).toFixed(1) 
      : '0.0';

    return NextResponse.json({
      success: true,
      metrics: {
        totalDispatches,
        deliveryRate: `${deliveryRate}%`,
        totalLeads: leadsCount,
        readCount,
        failedCount,
        whatsappStatus: tenant?.coexistence_status || 'CONNECTED',
        whatsappPhone: tenant?.whatsapp_number || 'Não cadastrado',
        tenantName: tenant?.name || 'Sua Empresa',
        segment: tenant?.segment || 'geral',
        campaignsCount: campaigns?.length || 0
      }
    });

  } catch (error: any) {
    console.error('[Dashboard Stats API Error]', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
