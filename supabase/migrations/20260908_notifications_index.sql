-- A tabela notifications já existia no schema mas nunca tinha índice pra
-- consulta real (por usuário, não lidas primeiro).
CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON public.notifications(user_id, is_read, created_at DESC);
