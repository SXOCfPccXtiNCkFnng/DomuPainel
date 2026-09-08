-- Reajustes agendados por assinatura: aumento de preço em assinante já ativo
-- só entra em vigor após aviso prévio (30 dias) e é aplicado automaticamente
-- na Asaas pelo cron /api/billing/apply-price-changes.
CREATE TABLE IF NOT EXISTS public.subscription_price_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    asaas_subscription_id VARCHAR(100),
    plan_tier VARCHAR(30) NOT NULL,
    old_price_brl NUMERIC(10, 2) NOT NULL,
    new_price_brl NUMERIC(10, 2) NOT NULL,
    effective_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notified_at TIMESTAMP WITH TIME ZONE,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_price_changes_pending
    ON public.subscription_price_changes(effective_at) WHERE applied_at IS NULL;

ALTER TABLE public.subscription_price_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_price_changes'
      AND policyname = 'deny_all_subscription_price_changes'
  ) THEN
    CREATE POLICY deny_all_subscription_price_changes ON public.subscription_price_changes
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
