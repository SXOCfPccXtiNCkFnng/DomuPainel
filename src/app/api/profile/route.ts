import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { applySessionCookie, requireAuth } from '@/lib/requireAuth';
import {
  hashPassword,
  isPasswordStrong,
  verifyPassword,
} from '@/lib/authHelpers';

export const dynamic = 'force-dynamic';

/** GET — retorna dados do perfil do usuário logado */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const { userId, tenantId } = auth.session;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, phone, role, created_at')
    .eq('id', userId)
    .single();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Usuário não encontrado.' },
      { status: 404 }
    );
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, whatsapp_number')
    .eq('id', tenantId)
    .single();

  return NextResponse.json({
    success: true,
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      createdAt: user.created_at,
      companyName: tenant?.name || '',
      whatsappNumber: tenant?.whatsapp_number || '',
    },
  });
}

/** PATCH — atualiza nome, phone e/ou senha */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  const { userId } = auth.session;
  const body = await req.json();
  const { name, phone, currentPassword, newPassword } = body as {
    name?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const updates: Record<string, string> = {};

  if (name !== undefined) {
    const trimmed = (name as string).trim();
    if (trimmed.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Nome precisa ter pelo menos 2 caracteres.' },
        { status: 400 }
      );
    }
    updates.name = trimmed;
  }

  if (phone !== undefined) {
    updates.phone = (phone as string).trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Informe a senha atual para trocar.' },
        { status: 400 }
      );
    }

    const strength = isPasswordStrong(newPassword as string);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, error: strength.reason || 'Senha fraca.' },
        { status: 400 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado.' },
        { status: 404 }
      );
    }

    const check = await verifyPassword(
      currentPassword as string,
      user.password_hash
    );
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: 'Senha atual incorreta.' },
        { status: 403 }
      );
    }

    updates.password_hash = await hashPassword(newPassword as string);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'Nenhum campo para atualizar.' },
      { status: 400 }
    );
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('[Profile PATCH]', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao salvar perfil.' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({
    success: true,
    message: 'Perfil atualizado com sucesso.',
  });

  // Senha nova invalida todas as sessões (outros aparelhos saem);
  // reemite o cookie só para este navegador continuar logado.
  if (updates.password_hash) {
    applySessionCookie(
      res,
      {
        userId,
        tenantId: auth.session.tenantId,
        role: auth.session.role,
        passwordHash: updates.password_hash,
      },
      auth.session.rememberMe ?? true
    );
  }

  return res;
}
