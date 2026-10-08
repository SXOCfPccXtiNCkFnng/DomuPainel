-- Troca de plano (upgrade/downgrade) sem derrubar a assinatura atual.
-- Antes o checkout cancelava a assinatura vigente no Asaas e marcava a conta
-- como PENDING_PAYMENT na hora — quem clicava em "upgrade" e não pagava ficava
-- com os disparos bloqueados. Agora a troca fica "pendente" nestas colunas e só
-- é efetivada (e a assinatura antiga cancelada) quando o novo pagamento cai.
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS pending_plan_tier VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pending_monthly_price_brl NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS pending_payment_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pending_coupon_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS pending_asaas_subscription_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pending_created_at TIMESTAMP WITH TIME ZONE;
