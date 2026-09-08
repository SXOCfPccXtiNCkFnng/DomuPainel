-- Preços dos planos editáveis pelo /interno (em vez de fixos no código).
-- Só afeta cadastros novos e trocas/reativações de plano a partir de agora —
-- assinaturas Asaas já ativas mantêm o valor contratado (ver Termos de Uso, seção 5).
CREATE TABLE IF NOT EXISTS public.plan_prices (
    plan_tier VARCHAR(30) PRIMARY KEY,
    price_brl NUMERIC(10, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.plan_prices (plan_tier, price_brl) VALUES
    ('STARTER', 197.00),
    ('PRO', 497.00),
    ('ENTERPRISE', 997.00)
ON CONFLICT (plan_tier) DO NOTHING;

ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_prices' AND policyname = 'deny_all_plan_prices'
  ) THEN
    CREATE POLICY deny_all_plan_prices ON public.plan_prices
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
