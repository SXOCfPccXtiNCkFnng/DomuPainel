-- Preço dos planos por ramo (imobiliário, automotivo...), editável no /interno.
-- plan_prices continua sendo o preço padrão; uma linha aqui substitui o padrão
-- só para aquele ramo e plano. Sem linha = o ramo usa o preço padrão.
CREATE TABLE IF NOT EXISTS public.segment_plan_prices (
    segment VARCHAR(40) NOT NULL,
    plan_tier VARCHAR(30) NOT NULL,
    price_brl NUMERIC(10, 2) NOT NULL CHECK (price_brl > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (segment, plan_tier)
);

ALTER TABLE public.segment_plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS segment_plan_prices_deny_all ON public.segment_plan_prices;
CREATE POLICY segment_plan_prices_deny_all ON public.segment_plan_prices
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
