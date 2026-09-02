import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

/** Contagem de respostas reais (chat inbound) no período */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');

    let query = supabaseAdmin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'INBOUND')
      .eq('tenant_id', tenantId);

    if (since) query = query.gte('created_at', since);

    const { count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (error: any) {
    console.error('[Replies API]', error);
    return NextResponse.json({ success: false, error: error.message, count: 0 }, { status: 500 });
  }
}
