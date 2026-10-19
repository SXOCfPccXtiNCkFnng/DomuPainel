-- Nova tabela de limites (outubro/2026): Starter 500, Pro 2.000, Enterprise 6.000
-- disparos/mês. O limite fica gravado na assinatura quando ela é ativada e tem
-- prioridade sobre o código, então as assinaturas existentes são alinhadas aqui.
-- Preços NÃO mudam por aqui: altere no /interno > Comercial, que já cuida de
-- quem é assinante (redução aplica na hora; aumento tem aviso de 30 dias).
UPDATE public.subscriptions
SET monthly_message_limit = CASE plan_tier
        WHEN 'PRO' THEN 2000
        WHEN 'ENTERPRISE' THEN 6000
        ELSE 500
    END,
    updated_at = NOW();

ALTER TABLE public.subscriptions ALTER COLUMN monthly_message_limit SET DEFAULT 500;
