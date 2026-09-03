import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthSession } from '@/lib/requireAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

function notFound() {
  return NextResponse.json(
    { success: false, error: 'Not Found' },
    { status: 404 }
  );
}

export function parsePlatformAdminEmails(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

export function getPlatformAdminEmails(): string[] {
  return parsePlatformAdminEmails(process.env.PLATFORM_ADMIN_EMAILS);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const allowed = getPlatformAdminEmails();
  if (allowed.length === 0) return false;
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized) && allowed.includes(normalized);
}

/**
 * Painel interno da operação Domu.
 * Sem allowlist ou e-mail fora dela → 404 (não revela que a rota existe).
 */
export async function requirePlatformAdmin(
  req: NextRequest
): Promise<{ session: AuthSession; email: string } | { error: NextResponse }> {
  const allowed = getPlatformAdminEmails();
  if (allowed.length === 0) return { error: notFound() };

  const auth = requireAuth(req);
  if ('error' in auth) return { error: notFound() };

  const limit = checkRateLimit(`interno:${auth.session.userId}`, 40, 60 * 1000);
  if (!limit.ok) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Not Found' },
        { status: 404 }
      ),
    };
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, tenant_id')
    .eq('id', auth.session.userId)
    .maybeSingle();

  if (!user?.email || user.tenant_id !== auth.session.tenantId) {
    return { error: notFound() };
  }

  if (!isPlatformAdminEmail(user.email)) {
    return { error: notFound() };
  }

  return { session: auth.session, email: String(user.email) };
}
