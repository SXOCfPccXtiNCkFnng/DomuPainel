import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isValidTeamRole, TEAM_ROLES } from '@/lib/requireAuth';
import { getPlanUserLimit, normalizePlanTier } from '@/lib/planLimits';
import {
  appBaseUrl,
  contactFooterText,
  generateSecureToken,
  hashToken,
  sendEmail,
} from '@/lib/email';
import { brandedEmailHtml } from '@/lib/emailTemplates';
import { logger } from '@/lib/logger';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const [{ data: users }, { data: invites }] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, name, email, role, last_login_at, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('user_invites')
        .select('id, name, email, role, expires_at, accepted_at, created_at')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      success: true,
      users: users || [],
      invites: invites || [],
      roles: TEAM_ROLES,
    });
  } catch (error: any) {
    logger.error('team.list_error', { message: error?.message });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const ip = clientIpFromRequest(req);
    const limit = checkRateLimit(`invite:ip:${ip}`, 20, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitos convites. Aguarde e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    const role = String(body.role || 'ATTENDANT').toUpperCase();

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Nome e e-mail válidos são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!isValidTeamRole(role)) {
      return NextResponse.json(
        { success: false, error: `Role inválida. Use: ${TEAM_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Este e-mail já possui conta na Domu Tech.' },
        { status: 400 }
      );
    }

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_tier')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const userLimit = getPlanUserLimit(subscription?.plan_tier);
    const { count: userCount } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    const { count: inviteCount } = await supabaseAdmin
      .from('user_invites')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('accepted_at', null);

    if ((userCount || 0) + (inviteCount || 0) >= userLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `Limite de ${userLimit} usuários do plano ${normalizePlanTier(subscription?.plan_tier)} atingido.`,
        },
        { status: 429 }
      );
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await supabaseAdmin
      .from('user_invites')
      .upsert(
        {
          tenant_id: tenantId,
          email,
          name,
          role,
          token_hash: tokenHash,
          invited_by: auth.session.userId,
          expires_at: expiresAt,
          accepted_at: null,
        },
        { onConflict: 'tenant_id,email' }
      )
      .select('id, email, name, role, expires_at')
      .single();

    if (error) throw error;

    const base = appBaseUrl(req.nextUrl.origin);
    const inviteUrl = `${base}/convite?token=${rawToken}`;
    const roleLabel =
      { ADMIN: 'Administrador', BROKER: 'Corretor', ATTENDANT: 'Atendente' }[role] || role;

    const mailed = await sendEmail({
      to: email,
      subject: 'Você foi convidado para o Portal Domu Tech',
      text: `Olá ${name},\n\nVocê foi convidado como ${roleLabel} no Portal Domu Tech.\nAceite o convite (válido por 7 dias):\n${inviteUrl}${contactFooterText()}`,
      html: brandedEmailHtml({
        heading: 'Você foi convidado!',
        bodyHtml: `<p style="margin:0 0 12px;">Olá, <strong>${name}</strong>!</p>
          <p style="margin:0 0 12px;">Você foi convidado para acessar o Portal Domu Tech como <strong>${roleLabel}</strong>. Clique no botão abaixo pra criar sua senha e começar — o convite vale por <strong>7 dias</strong>.</p>`,
        ctaLabel: 'Aceitar convite',
        ctaUrl: inviteUrl,
      }),
    });

    logger.info('team.invite_created', { tenantId, email, role });

    const isProd = process.env.NODE_ENV === 'production';
    return NextResponse.json({
      success: true,
      invite,
      // Em produção nunca devolver o token cru; em dev ajuda o teste local
      ...(isProd || !mailed.ok ? {} : { inviteUrl }),
      message: mailed.ok
        ? isProd
          ? 'Convite criado e e-mail enviado.'
          : 'Convite criado. Enviamos o e-mail (ou veja o link abaixo em modo dev).'
        : mailed.error || 'Convite criado, mas o e-mail não foi enviado.',
      emailSent: mailed.ok,
    });
  } catch (error: any) {
    logger.error('team.invite_error', { message: error?.message });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const body = await req.json();
    const userId = String(body.userId || '');
    const role = String(body.role || '').toUpperCase();

    if (!userId || !isValidTeamRole(role)) {
      return NextResponse.json({ success: false, error: 'userId e role válidos são obrigatórios.' }, { status: 400 });
    }

    if (userId === auth.session.userId && role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Você não pode remover sua própria função de administrador.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const inviteId = searchParams.get('inviteId');

    if (inviteId) {
      await supabaseAdmin
        .from('user_invites')
        .delete()
        .eq('id', inviteId)
        .eq('tenant_id', tenantId);
      return NextResponse.json({ success: true });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId ou inviteId obrigatório.' }, { status: 400 });
    }

    if (userId === auth.session.userId) {
      return NextResponse.json(
        { success: false, error: 'Você não pode remover a si mesmo.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
