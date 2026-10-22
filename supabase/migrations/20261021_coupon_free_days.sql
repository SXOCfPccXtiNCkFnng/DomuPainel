-- Cupom de dias grátis: libera o plano por X dias e a primeira cobrança vence
-- no fim desse período. Um cupom é OU de desconto (percent_off) OU de dias.
ALTER TABLE public.billing_coupons
  ADD COLUMN IF NOT EXISTS free_days INT CHECK (free_days IS NULL OR (free_days BETWEEN 1 AND 365));
