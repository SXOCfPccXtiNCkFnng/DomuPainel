import { NextRequest } from 'next/server';
import crypto from 'crypto';

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Autentica chamadas de cron externo via Authorization: Bearer CRON_SECRET (ou header customizado). */
export function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.DOMU_CRON_SECRET;
  if (!secret || secret.length < 16) return false;

  const authHeader = req.headers.get('authorization') || '';
  const customHeader =
    req.headers.get('x-domu-cron-secret') || req.headers.get('x-cron-secret') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const rawAuth = authHeader.trim();

  if (bearer && timingSafeStringEqual(bearer, secret)) return true;
  if (rawAuth && timingSafeStringEqual(rawAuth, secret)) return true;
  if (customHeader && timingSafeStringEqual(customHeader, secret)) return true;

  return false;
}
