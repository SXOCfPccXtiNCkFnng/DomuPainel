-- Observabilidade do painel /interno.

-- 1) Alertas agrupados: o mesmo erro repetido vira uma linha com contador,
--    em vez de centenas de linhas iguais. "Resolvido" tira da lista de abertos;
--    se o erro voltar depois, abre de novo.
ALTER TABLE public.ops_alerts ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);
ALTER TABLE public.ops_alerts ADD COLUMN IF NOT EXISTS occurrences INT NOT NULL DEFAULT 1;
ALTER TABLE public.ops_alerts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.ops_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.ops_alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255);

UPDATE public.ops_alerts SET last_seen_at = created_at WHERE last_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ops_alerts_open_fingerprint
    ON public.ops_alerts (fingerprint, last_seen_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ops_alerts_last_seen
    ON public.ops_alerts (last_seen_at DESC);

-- 2) Batimentos: última execução de cada cron e último evento de cada webhook.
--    É o que mostra "o cron parou" antes de um cliente reclamar.
CREATE TABLE IF NOT EXISTS public.system_heartbeats (
    name VARCHAR(80) PRIMARY KEY,
    last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ok_at TIMESTAMPTZ,
    last_error TEXT,
    last_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_count BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.system_heartbeats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_heartbeats' AND policyname = 'deny_all_system_heartbeats'
  ) THEN
    CREATE POLICY deny_all_system_heartbeats ON public.system_heartbeats
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
