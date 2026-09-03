-- Alertas da operação (painel /interno)

CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(80) NOT NULL,
  level VARCHAR(12) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_created ON public.ops_alerts(created_at DESC);

ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ops_alerts' AND policyname = 'deny_all_ops_alerts'
  ) THEN
    CREATE POLICY deny_all_ops_alerts ON public.ops_alerts
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
