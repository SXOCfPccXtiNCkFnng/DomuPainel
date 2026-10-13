import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { loadPlatformHealth } from '@/lib/platformHealth';

export const dynamic = 'force-dynamic';

/** Diagnóstico da plataforma (banco, configuração, integrações, crons, filas). */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  try {
    const health = await loadPlatformHealth();
    return NextResponse.json({ success: true, health });
  } catch (error) {
    console.error('[interno health]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Falha ao rodar o diagnóstico.' },
      { status: 500 }
    );
  }
}
