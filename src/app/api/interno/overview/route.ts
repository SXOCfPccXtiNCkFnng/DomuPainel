import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { loadPlatformOverview } from '@/lib/platformOverview';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin(req);
    if ('error' in gate) return gate.error;

    const overview = await loadPlatformOverview();
    return NextResponse.json({ success: true, overview });
  } catch (error) {
    console.error('[interno overview]', error);
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
  }
}
