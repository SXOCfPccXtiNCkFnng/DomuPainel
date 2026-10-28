-- Visita com data e hora marcadas e lembrete para o cliente (imobiliário).
-- O corretor escolhe quanto tempo antes o cliente recebe o aviso.
--   scheduled_at: data e hora combinadas (o pedido da IA só tem a preferência em texto)
--   reminder_minutes: antecedência do aviso (null = sem aviso)
--   reminder_sent_at: preenchido no claim (nunca manda duas vezes)
ALTER TABLE public.visit_requests
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reminder_minutes INT CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 5 AND 10080),
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reminder_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS reminder_note TEXT;

-- O pedido feito pela IA tinha preferência obrigatória; visita marcada pelo corretor pode não ter.
ALTER TABLE public.visit_requests ALTER COLUMN preferred_time DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visit_requests_reminders_due
    ON public.visit_requests (scheduled_at)
    WHERE status = 'CONFIRMED' AND reminder_sent_at IS NULL AND reminder_minutes IS NOT NULL;

-- Modelo (template UTILITY) do lembrete de visita, criado sozinho na Meta por conta.
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS visit_reminder_template_id UUID REFERENCES public.hsm_templates(id) ON DELETE SET NULL;
