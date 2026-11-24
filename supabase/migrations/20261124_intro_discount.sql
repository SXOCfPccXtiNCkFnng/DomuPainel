-- Desconto de entrada (ex.: Black Friday): dias grátis + X% nas N primeiras
-- mensalidades pagas; depois a assinatura volta sozinha para o preço cheio.
--   billing_coupons.discount_months: quantas mensalidades pagas têm o desconto
--   (junto com free_days e percent_off). Sem isso, o cupom de % vale sempre.
ALTER TABLE public.billing_coupons
    ADD COLUMN IF NOT EXISTS discount_months INT CHECK (discount_months IS NULL OR discount_months BETWEEN 1 AND 12);

-- Na assinatura: quantas mensalidades com desconto ainda faltam, o preço cheio
-- que volta depois e o último pagamento contado (reentrega do webhook não conta duas vezes).
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS intro_discount_payments_left INT,
    ADD COLUMN IF NOT EXISTS intro_full_price_brl NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS intro_last_payment_id VARCHAR(100);
