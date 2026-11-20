-- "Pergunte para a IA" (planos Pro e Enterprise): perguntas do dono sobre os
-- números da conta e as respostas. Serve de histórico na tela e para contar a
-- cota mensal de perguntas do plano.
CREATE TABLE IF NOT EXISTS public.ai_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    question VARCHAR(500) NOT NULL,
    answer TEXT,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_questions_tenant_created ON public.ai_questions (tenant_id, created_at DESC);

ALTER TABLE public.ai_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_questions_deny_all ON public.ai_questions;
CREATE POLICY ai_questions_deny_all ON public.ai_questions
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
