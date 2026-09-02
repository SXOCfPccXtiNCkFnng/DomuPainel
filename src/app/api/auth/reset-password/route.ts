import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { hashPassword, isPasswordStrong } from '@/lib/authHelpers';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rateLimit';
import { hashToken } from '@/lib/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const limit = checkRateLimit(`reset:ip:${ip}`, 15, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');

    if (!token || token.length < 32) {
      return NextResponse.json(
        { success: false, error: 'Link inválido ou expirado.' },
        { status: 400 }
      );
    }

    const strength = isPasswordStrong(password);
    if (!strength.valid) {
      return NextResponse.json({ success: false, error: strength.reason }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const { data: row } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Link inválido ou expirado. Solicite um novo.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', row.user_id);

    if (userError) throw userError;

    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id);

    await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', row.user_id)
      .is('used_at', null)
      .neq('id', row.id);

    logger.info('auth.password_reset_ok', { userId: row.user_id });
    return NextResponse.json({
      success: true,
      message: 'Senha atualizada. Você já pode fazer login.',
    });
  } catch (error: any) {
    logger.error('auth.reset_error', { message: error?.message });
    return NextResponse.json(
      { success: false, error: 'Erro ao redefinir senha.' },
      { status: 500 }
    );
  }
}
