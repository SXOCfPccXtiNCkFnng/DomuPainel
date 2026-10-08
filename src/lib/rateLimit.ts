type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60 * 1000;

/** Remove janelas vencidas — sem isso o Map cresce para sempre (uma chave por IP/e-mail). */
function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Rate limit em memória (por processo). Adequado para single-instance / MVP.
 * key: ex. `login:1.2.3.4` ou `register:email@x.com`
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec?: number; remaining: number } {
  const now = Date.now();
  sweepExpired(now);
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: Math.max(0, limit - bucket.count) };
}

export function clientIpFromRequest(req: { headers: Headers }): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}
