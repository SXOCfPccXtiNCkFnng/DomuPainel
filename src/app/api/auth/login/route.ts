import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { hashPassword, verifyPassword } from '@/lib/authHelpers';
import { isTenantOnboarded } from '@/lib/sessionHelpers';
import { applySessionCookie } from '@/lib/requireAuth';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rateLimit';
import { TenantSegment } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const ipLimit = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde e tente novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSec || 60) },
        }
      );
    }

    const body = await req.json();
    const { email, password, rememberMe = true } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailLimit = checkRateLimit(`login:email:${cleanEmail}`, 10, 15 * 60 * 1000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas para este e-mail. Aguarde e tente novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(emailLimit.retryAfterSec || 60) },
        }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, tenants(*)')
      .eq('email', cleanEmail)
      .single();

    const verify = user
      ? await verifyPassword(password, user.password_hash)
      : { ok: false, needsRehash: false };

    // Custo similar quando usuário não existe (mitiga timing/enumeration)
    if (!user) await hashPassword(password);

    if (userError || !user || !verify.ok) {
      return NextResponse.json(
        { success: false, error: 'E-mail ou senha incorretos. Verifique suas credenciais.' },
        { status: 401 }
      );
    }

    const patch: Record<string, unknown> = {
      last_login_at: new Date().toISOString(),
    };
    if (verify.needsRehash) {
      patch.password_hash = await hashPassword(password);
    }

    await supabaseAdmin.from('users').update(patch).eq('id', user.id);

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    const tenant = user.tenants;
    const isOnboarded = isTenantOnboarded(subscription, tenant);

    const res = NextResponse.json({
      success: true,
      message: 'Autenticado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        companyName: tenant?.name || 'Domu Tech Empresa',
        segment: (tenant?.segment as TenantSegment) || 'geral',
        isOnboarded,
      },
    });

    applySessionCookie(
      res,
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role || 'ADMIN',
      },
      Boolean(rememberMe)
    );

    return res;
  } catch (error: any) {
    console.error('[Login API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao processar login.' },
      { status: 500 }
    );
  }
}
