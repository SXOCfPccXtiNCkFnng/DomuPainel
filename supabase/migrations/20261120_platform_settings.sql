-- Configurações da operação Domu que mudam sem deploy (chave → valor).
--   sales_agent: { "enabled": true|false } — liga/desliga a vendedora da Domu
--   (Modo teste do painel). Sem a linha, a vendedora fica ligada.
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key VARCHAR(60) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_deny_anon ON public.platform_settings;
CREATE POLICY platform_settings_deny_anon ON public.platform_settings
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS platform_settings_deny_authenticated ON public.platform_settings;
CREATE POLICY platform_settings_deny_authenticated ON public.platform_settings
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
