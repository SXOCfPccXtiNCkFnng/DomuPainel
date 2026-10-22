import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { loadPlatformUsers } from '@/lib/platformUsers';

export const dynamic = 'force-dynamic';

/** Pessoas cadastradas: contato, empresa, pagamento e último login. Fora da allowlist → 404. */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const data = await loadPlatformUsers();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('[interno users]', error);
    return NextResponse.json({ success: false, error: 'Não foi possível carregar os cadastros.' }, { status: 500 });
  }
}
