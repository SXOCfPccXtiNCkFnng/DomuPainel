import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isTenantOnboarded } from '@/lib/sessionHelpers';
import { getSessionFromRequest, requireAuth } from '@/lib/requireAuth';
import { isPlatformAdminEmail } from '@/lib/platformAdmin';
import { TenantSegment } from '@/types';

export const dynamic = 'force-dynamic';

/** Sessão autenticada — tenant vem do cookie, nunca do query string. */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;

    const { tenantId, userId } = auth.session;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, segment, status, whatsapp_number')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant não encontrado.' },
        { status: 404 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId)
      .maybeSingle();

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      authenticated: true,
      isOnboarded: isTenantOnboarded(subscription, tenant),
      segment: (tenant.segment as TenantSegment) || 'geral',
      companyName: tenant.name || 'Empresa DOMU',
      tenantId: tenant.id,
      whatsappPhone: tenant.whatsapp_number || '',
      user: user
        ? { id: user.id, name: user.name, email: user.email, role: user.role }
        : null,
      isPlatformAdmin: isPlatformAdminEmail(user?.email),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno.';
    console.error('[Session API Error]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Health check leve: cookie válido? (sem vazar dados) */
export async function HEAD(req: NextRequest) {
  const session = getSessionFromRequest(req);
  return new NextResponse(null, { status: session ? 204 : 401 });
}
