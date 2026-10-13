import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { loadOpsAlerts, resolveOpsAlert, resolveOpsAlertsBySource } from '@/lib/opsAlert';

export const dynamic = 'force-dynamic';

/** Lista de erros/avisos agrupados. Query: ?status=open|resolved|all&level=error|warn|all&source=&tenantId= */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  const q = new URL(req.url).searchParams;
  const status = (['open', 'resolved', 'all'] as const).find((s) => s === q.get('status')) || 'open';
  const level = (['error', 'warn', 'all'] as const).find((s) => s === q.get('level')) || 'all';
  const alerts = await loadOpsAlerts({
    status,
    level,
    source: q.get('source') || null,
    tenantId: q.get('tenantId') || null,
    limit: 300,
  });
  return NextResponse.json({ success: true, alerts });
}

/** Marca como resolvido/reaberto: { id, resolved } ou todos de uma origem: { source }. */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; resolved?: boolean; source?: string };
  try {
    if (body.source) {
      const count = await resolveOpsAlertsBySource(body.source, gate.email);
      return NextResponse.json({ success: true, count });
    }
    if (!body.id) return NextResponse.json({ success: false, error: 'Informe o alerta.' }, { status: 400 });
    const ok = await resolveOpsAlert(body.id, gate.email, body.resolved !== false);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Falha ao atualizar.' },
      { status: 500 }
    );
  }
}
