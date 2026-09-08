-- Evita reenviar o e-mail com QR PIX de renovação toda vez que o webhook Asaas
-- reconfirma o mesmo payment pendente (guarda o payment.id já avisado).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pix_renewal_email_sent_for_payment_id VARCHAR(100);
