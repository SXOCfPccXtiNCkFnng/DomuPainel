import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Sessão encerrada.' });
  clearSessionCookie(res);
  return res;
}
