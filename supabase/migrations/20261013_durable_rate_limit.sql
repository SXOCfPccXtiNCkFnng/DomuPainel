-- Limite de tentativas que vale para todos os servidores.
-- O limite em memória vale por instância: em hospedagem serverless (várias
-- instâncias) um ataque de força bruta no login conseguia contornar. Aqui a
-- contagem fica no banco, com incremento atômico.

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key VARCHAR(200) PRIMARY KEY,
    count INT NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON public.rate_limits (reset_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rate_limits' AND policyname = 'deny_all_rate_limits'
  ) THEN
    CREATE POLICY deny_all_rate_limits ON public.rate_limits
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;

-- Registra uma tentativa e devolve quantas já houve na janela atual
-- (e quando ela termina). Janela vencida recomeça do 1.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key TEXT, p_window_seconds INT)
RETURNS TABLE (hits INT, resets_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, NOW() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count = CASE WHEN r.reset_at <= NOW() THEN 1 ELSE r.count + 1 END,
        reset_at = CASE WHEN r.reset_at <= NOW() THEN NOW() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING r.count, r.reset_at;
$$;

-- Só o servidor (service role) chama.
REVOKE ALL ON FUNCTION public.hit_rate_limit(TEXT, INT) FROM PUBLIC, anon, authenticated;

-- Limpeza: linhas vencidas há mais de 1 dia (chamada pelo próprio código, de vez em quando).
CREATE OR REPLACE FUNCTION public.purge_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE reset_at < NOW() - INTERVAL '1 day';
$$;

REVOKE ALL ON FUNCTION public.purge_rate_limits() FROM PUBLIC, anon, authenticated;
