-- Verificação em duas etapas (aplicativo autenticador, TOTP) no login próprio.
-- O segredo fica criptografado (AES-256-GCM, mesma chave dos tokens da Meta).
-- totp_pending_*: segredo gerado na ativação, até o usuário confirmar o 1º código.
-- totp_last_step: último código aceito (o mesmo código não vale duas vezes).
-- totp_recovery_hashes: códigos de recuperação (só o hash; cada um vale uma vez).
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT,
    ADD COLUMN IF NOT EXISTS totp_secret_iv TEXT,
    ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS totp_pending_enc TEXT,
    ADD COLUMN IF NOT EXISTS totp_pending_iv TEXT,
    ADD COLUMN IF NOT EXISTS totp_last_step BIGINT,
    ADD COLUMN IF NOT EXISTS totp_recovery_hashes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
