import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { hashPassword, isPasswordStrong } from '@/lib/authHelpers';
import { applySessionCookie } from '@/lib/requireAuth';
import { hashToken } from '@/lib/email';
import { logger } from '@/lib/logger';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token') || '';
    if (!token || token.length < 32) {
      return NextResponse.json({ success: false, error: 'Convite inválido.' }, { status: 400 });
    }

    const { data: invite } = await supabaseAdmin
      .from('user_invites')
      .select('id, name, email, role, expires_at, accepted_at, tenants(name)')
      .eq('token_hash', hashToken(token))
      .maybeSingle();

    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Convite inválido ou expirado.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invite: {
        name: invite.name,
        email: invite.email,
        role: invite.role,
        companyName: (invite as any).tenants?.name || 'Empresa',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const limit = checkRateLimit(`accept-invite:ip:${ip}`, 15, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ success: false, error: 'Muitas tentativas.' }, { status: 429 });
    }

    const body = await req.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');

    if (!token || token.length < 32) {
      return NextResponse.json({ success: false, error: 'Convite inválido.' }, { status: 400 });
    }

    const strength = isPasswordStrong(password);
    if (!strength.valid) {
      return NextResponse.json({ success: false, error: strength.reason }, { status: 400 });
    }

    const { data: invite } = await supabaseAdmin
      .from('user_invites')
      .select('*')
      .eq('token_hash', hashToken(token))
      .maybeSingle();

    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Convite inválido ou expirado.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        tenant_id: invite.tenant_id,
        name: invite.name,
        email: invite.email,
        password_hash: passwordHash,
        role: invite.role,
      })
      .select('id, name, email, role, tenant_id')
      .single();

    if (userError) {
      if (userError.message?.includes('duplicate') || userError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Este e-mail já está cadastrado. Faça login.' },
          { status: 400 }
        );
      }
      throw userError;
    }

    await supabaseAdmin
      .from('user_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name, segment')
      .eq('id', invite.tenant_id)
      .maybeSingle();

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        companyName: tenant?.name || 'Empresa',
        segment: tenant?.segment || 'geral',
        isOnboarded: true,
      },
    });

    applySessionCookie(
      res,
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      true
    );

    logger.info('team.invite_accepted', { userId: user.id, tenantId: invite.tenant_id });
    return res;
  } catch (error: any) {
    logger.error('team.accept_error', { message: error?.message });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
