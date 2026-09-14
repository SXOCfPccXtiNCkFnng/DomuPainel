/**
 * Erros do Postgrest/Supabase não são instanceof Error — só têm .message,
 * .code, .details, .hint. Sem isso, os catches genéricos jogavam fora o
 * motivo real e só logavam texto fixo tipo "Erro no cron.".
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const parts = [obj.message, obj.details, obj.hint, obj.code]
      .filter((v) => typeof v === 'string' && v.length > 0)
      .join(' | ');
    if (parts) return parts;
    try {
      return JSON.stringify(obj);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
