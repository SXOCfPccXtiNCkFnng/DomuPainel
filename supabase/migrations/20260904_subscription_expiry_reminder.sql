-- Evita reenviar o aviso de vencimento todo dia dentro da mesma janela de 3 dias.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMP WITH TIME ZONE;
