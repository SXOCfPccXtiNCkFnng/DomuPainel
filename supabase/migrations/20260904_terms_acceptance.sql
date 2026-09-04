-- Registro de aceite dos Termos de Uso / Política de Privacidade por usuário.
-- Necessário para comprovar consentimento (LGPD) em caso de disputa.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS terms_accepted_ip VARCHAR(64);
