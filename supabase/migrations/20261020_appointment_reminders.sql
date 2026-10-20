-- Lembretes do agendamento para o cliente final pelo WhatsApp:
-- 1 hora antes e outro "em cima da hora" (15 ou 30 min antes).
-- Dentro da janela de 24h da conversa vai texto livre; fora dela, o modelo
-- (template UTILITY) que a Domu cria sozinha na Meta para cada conta.

-- 1) Configuração por conta.
ALTER TABLE public.scheduling_settings
    ADD COLUMN IF NOT EXISTS reminder_hour_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS reminder_soon_minutes INT NOT NULL DEFAULT 15 CHECK (reminder_soon_minutes IN (0, 15, 30)),
    ADD COLUMN IF NOT EXISTS reminder_template_id UUID REFERENCES public.hsm_templates(id) ON DELETE SET NULL;

-- 2) Controle por agendamento (preenchido no claim: nunca manda duas vezes).
--    reminder_status: SENT · FAILED · SKIPPED (último lembrete processado)
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS reminder_hour_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reminder_soon_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reminder_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS reminder_note TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_reminders_due
    ON public.appointments (starts_at)
    WHERE status = 'CONFIRMED';
