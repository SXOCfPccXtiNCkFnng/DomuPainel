-- Dicas da semana (ramos com agenda): números da semana calculados pela Domu
-- e as dicas que a IA escreveu a partir deles. Uma linha por conta por semana.
--   week_start / week_end: os 7 dias do resumo (datas de Brasília).
--   metrics: números (faturamento, serviços, dias, clientes que sumiram...).
--   tips: [{ "title", "text", "action" }] — action leva a uma tela do painel.
CREATE TABLE IF NOT EXISTS public.weekly_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    metrics JSONB NOT NULL,
    tips JSONB NOT NULL DEFAULT '[]'::jsonb,
    ai_used BOOLEAN NOT NULL DEFAULT FALSE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_insights_tenant_week
    ON public.weekly_insights (tenant_id, week_start DESC);

ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_insights_deny_anon ON public.weekly_insights;
CREATE POLICY weekly_insights_deny_anon ON public.weekly_insights
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS weekly_insights_deny_authenticated ON public.weekly_insights;
CREATE POLICY weekly_insights_deny_authenticated ON public.weekly_insights
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
