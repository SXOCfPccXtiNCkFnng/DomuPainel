-- Follow-up automático: se o contato não responder, a Domu manda uma nova
-- mensagem do cliente. Dois tipos, configurados separadamente:
--
-- CONVERSA  — o contato escreveu nas últimas 24h (janela aberta do WhatsApp):
--             texto livre escrito pelo cliente, sem aprovação da Meta. Sai
--             sempre antes de a janela fechar.
-- CAMPANHA  — contato que recebeu campanha e nunca respondeu (sem janela):
--             a Meta só aceita template aprovado, então o texto do cliente
--             vira um template enviado para aprovação automaticamente.
--
-- Follow-up NÃO conta no limite de disparos do plano.

-- 1) Configuração por conta.
CREATE TABLE IF NOT EXISTS public.follow_up_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

    conversation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    conversation_message TEXT,
    conversation_delay_hours INT NOT NULL DEFAULT 24 CHECK (conversation_delay_hours BETWEEN 1 AND 24),

    campaign_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    campaign_message TEXT,
    campaign_delay_hours INT NOT NULL DEFAULT 24 CHECK (campaign_delay_hours BETWEEN 1 AND 168),
    template_id UUID REFERENCES public.hsm_templates(id) ON DELETE SET NULL,
    template_params JSONB NOT NULL DEFAULT '[]'::jsonb,
    template_note TEXT, -- motivo da reprovação da Meta, para mostrar ao cliente

    -- Proteções contra follow-up fora de contexto.
    ai_check_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    excluded_statuses TEXT[] NOT NULL DEFAULT ARRAY['FECHADO'],
    -- Horário de Brasília. Fim exclusivo: 8–20 envia das 08:00 às 19:59.
    window_start_hour INT NOT NULL DEFAULT 8 CHECK (window_start_hour BETWEEN 0 AND 23),
    window_end_hour INT NOT NULL DEFAULT 20 CHECK (window_end_hour BETWEEN 1 AND 24),
    skip_weekends BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (window_start_hour < window_end_hour)
);

-- 2) Fila.
--    status: PENDING · PROCESSING · SENT · REPLIED (respondeu antes)
--            CANCELLED (manual/desligado) · SKIPPED (barrado por uma proteção) · FAILED
--    skip_code (quando SKIPPED): CONTEXT (conversa encerrada — IA/palavras),
--            WINDOW_CLOSED, OPT_OUT, PAUSED, STATUS, NOT_WAITING, OTHER
CREATE TABLE IF NOT EXISTS public.follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    origin VARCHAR(20) NOT NULL, -- 'CONVERSATION', 'CAMPAIGN'
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    origin_wamid VARCHAR(150),
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- CONVERSA: depois disso a janela de 24h do WhatsApp fecha e não dá para enviar.
    deadline_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    skip_code VARCHAR(30),
    wamid VARCHAR(150),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE, -- respondeu DEPOIS do follow-up
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Um follow-up em aberto por contato: mensagem nova reinicia o relógio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_follow_ups_open_per_lead
    ON public.follow_ups (tenant_id, lead_id)
    WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_follow_ups_due
    ON public.follow_ups (due_at)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_follow_ups_tenant_created
    ON public.follow_ups (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_ups_tenant_sent
    ON public.follow_ups (tenant_id, sent_at)
    WHERE status = 'SENT';

-- 3) "Não fazer follow-up com esta pessoa".
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- Histórico da conversa por contato (checagem de contexto lê as últimas mensagens).
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_lead_created
    ON public.chat_messages (tenant_id, lead_id, created_at DESC);

-- Mesmo padrão das demais tabelas: só a API (service role) acessa.
ALTER TABLE public.follow_up_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['follow_up_settings', 'follow_ups']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_anon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t || '_deny_anon', t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t || '_deny_authenticated', t
    );
  END LOOP;
END $$;
