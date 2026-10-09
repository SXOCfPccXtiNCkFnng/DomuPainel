-- Limite de follow-up por contato: no máximo 1 follow-up a cada X horas para a
-- mesma pessoa (numa conversa longa em que o contato some várias vezes, ele não
-- recebe vários no mesmo dia). O cliente liga/desliga na tela de Follow-up.
ALTER TABLE public.follow_up_settings
    ADD COLUMN IF NOT EXISTS contact_limit_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.follow_up_settings
    ADD COLUMN IF NOT EXISTS contact_limit_hours INT NOT NULL DEFAULT 24;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'follow_up_settings_contact_limit_hours_check'
  ) THEN
    ALTER TABLE public.follow_up_settings
      ADD CONSTRAINT follow_up_settings_contact_limit_hours_check
      CHECK (contact_limit_hours BETWEEN 1 AND 720);
  END IF;
END $$;

-- skip_code ganha 'CONTACT_LIMIT' (texto livre, sem constraint a alterar).
