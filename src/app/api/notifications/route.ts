import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

/** Notificações do usuário logado (não do tenant inteiro — cada linha já nasce com user_id). */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;
  const { userId, tenantId } = auth.session;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, title, message, type, is_read, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const notifications = (data || []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.is_read,
    createdAt: n.created_at,
  }));

  return NextResponse.json({
    success: true,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  });
}

/** Marca uma notificação (body: {id}) ou todas (body: {markAllRead:true}) como lida. */
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if ('error' in auth) return auth.error;
  const { userId, tenantId } = auth.session;

  const body = await req.json().catch(() => ({}));

  if (body.markAllRead) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const id = String(body.id || '');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Informe o id da notificação.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
