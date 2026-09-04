import { NextRequest } from 'next/server';

/** Autentica chamadas de cron externo via Authorization: Bearer CRON_SECRET (ou header customizado). */
export function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.DOMU_CRON_SECRET;
  if (!secret || secret.length < 16) return false;

  const authHeader = req.headers.get('authorization') || '';
  const customHeader =
    req.headers.get('x-domu-cron-secret') || req.headers.get('x-cron-secret') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const rawAuth = authHeader.trim();

  if (bearer && bearer === secret) return true;
  if (rawAuth && rawAuth === secret) return true;
  if (customHeader && customHeader === secret) return true;

  return false;
}
