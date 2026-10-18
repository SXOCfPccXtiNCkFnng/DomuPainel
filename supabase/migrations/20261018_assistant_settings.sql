-- Assistente de IA do WhatsApp (segmento automotivo).
-- O cliente personaliza só campos estruturados; as regras de comportamento
-- (humanizada, focada no lava rápido, sem inventar preço/horário) ficam fixas
-- no código e não podem ser sobrescritas por estes campos.
CREATE TABLE IF NOT EXISTS public.assistant_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    assistant_name VARCHAR(40),
    tone VARCHAR(20) NOT NULL DEFAULT 'AMIGAVEL' CHECK (tone IN ('AMIGAVEL', 'PROFISSIONAL', 'DESCONTRAIDO')),
    use_emojis BOOLEAN NOT NULL DEFAULT TRUE,
    show_prices BOOLEAN NOT NULL DEFAULT TRUE,
    about TEXT CHECK (about IS NULL OR char_length(about) <= 400),
    address VARCHAR(300),
    payment_methods TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    extra_info TEXT CHECK (extra_info IS NULL OR char_length(extra_info) <= 800),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mesmo padrão das demais tabelas: só a API (service role) acessa.
ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assistant_settings_deny_anon ON public.assistant_settings;
CREATE POLICY assistant_settings_deny_anon ON public.assistant_settings
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS assistant_settings_deny_authenticated ON public.assistant_settings;
CREATE POLICY assistant_settings_deny_authenticated ON public.assistant_settings
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
