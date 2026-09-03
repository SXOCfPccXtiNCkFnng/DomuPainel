-- Billing: cupons Domu + campos auxiliares na assinatura (Asaas)

CREATE TABLE IF NOT EXISTS public.billing_coupons (
  code VARCHAR(40) PRIMARY KEY,
  percent_off NUMERIC(5, 2),
  amount_off_brl NUMERIC(10, 2),
  active BOOLEAN NOT NULL DEFAULT true,
  max_redemptions INT,
  redemption_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  plan_tiers TEXT[], -- null = todos
  first_invoice_only BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS pending_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_payment_status VARCHAR(40);

-- Cupons iniciais (edite no Supabase depois)
INSERT INTO public.billing_coupons (code, percent_off, description, active)
VALUES
  ('DOMU20', 20, '20% off no plano Domu Tech', true),
  ('BEMVINDO', 10, '10% off de boas-vindas', true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.billing_coupons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_coupons' AND policyname = 'deny_all_billing_coupons'
  ) THEN
    CREATE POLICY deny_all_billing_coupons ON public.billing_coupons
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
