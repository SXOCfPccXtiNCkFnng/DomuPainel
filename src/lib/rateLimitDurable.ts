import { supabaseAdmin } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Limite de tentativas que vale para TODAS as instâncias (contagem no banco).
 * Use nas rotas sensíveis (login, senha, cadastro, convite): em serverless o
 * limite só em memória é por instância e um ataque distribuído contorna.
 *
 * A memória continua como primeira barreira (barata). Se a função do banco
 * não existir ainda (migration pendente) ou falhar, vale só a memória — o
 * login nunca fica fora do ar por causa do limitador.
 */
export async function checkRateLimitDurable(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec?: number; remaining: number }> {
  const local = checkRateLimit(key, limit, windowMs);
  if (!local.ok) return local;

  try {
    const { data, error } = await supabaseAdmin.rpc('hit_rate_limit', {
      p_key: key.slice(0, 200),
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (error) return local;
    const row = Array.isArray(data) ? data[0] : data;
    const hits = Number(row?.hits ?? 0);
    if (Math.random() < 0.01) void supabaseAdmin.rpc('purge_rate_limits'); // limpeza ocasional
    if (hits > limit) {
      const resetsAt = row?.resets_at ? new Date(row.resets_at).getTime() : Date.now() + windowMs;
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)), remaining: 0 };
    }
    return { ok: true, remaining: Math.max(0, limit - hits) };
  } catch {
    return local;
  }
}
