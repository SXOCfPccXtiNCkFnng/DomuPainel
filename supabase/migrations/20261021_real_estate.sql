-- Módulo imobiliário (imobiliárias, corretores e construtoras).
-- Catálogo de imóveis que a atendente de IA consulta, perfil de interesse do
-- lead preenchido pela IA e pedidos de visita (plano Pro).

-- 1) Imóveis: campos que faltavam para a IA responder sem inventar.
--    purpose: VENDA · ALUGUEL · VENDA_E_ALUGUEL
--    price = valor de venda (ou o aluguel mensal quando purpose = ALUGUEL)
--    rent_price = aluguel mensal quando o imóvel é VENDA_E_ALUGUEL
--    link_url = anúncio com fotos (site/portal); a IA manda o link ao cliente
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'VENDA'
        CHECK (purpose IN ('VENDA', 'ALUGUEL', 'VENDA_E_ALUGUEL')),
    ADD COLUMN IF NOT EXISTS rent_price NUMERIC(14, 2) CHECK (rent_price IS NULL OR rent_price >= 0),
    ADD COLUMN IF NOT EXISTS condo_fee NUMERIC(12, 2) CHECK (condo_fee IS NULL OR condo_fee >= 0),
    ADD COLUMN IF NOT EXISTS parking_spots INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS description TEXT CHECK (description IS NULL OR char_length(description) <= 1500),
    ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS link_url TEXT CHECK (link_url IS NULL OR char_length(link_url) <= 500);

CREATE INDEX IF NOT EXISTS idx_properties_tenant_status
    ON public.properties (tenant_id, status);

-- 2) Perfil de interesse do lead (a IA preenche durante a conversa).
--    Já existiam: interest_property_type, budget_max, region, status (funil).
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS interest_purpose VARCHAR(20),
    ADD COLUMN IF NOT EXISTS bedrooms_min INT,
    ADD COLUMN IF NOT EXISTS ai_summary TEXT CHECK (ai_summary IS NULL OR char_length(ai_summary) <= 600),
    ADD COLUMN IF NOT EXISTS interest_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- 3) Pedidos de visita (Pro): a IA registra a preferência do cliente e o
--    corretor confirma — visita depende de chave, proprietário e agenda dele.
--    status: PENDING · CONFIRMED · DONE · CANCELLED
CREATE TABLE IF NOT EXISTS public.visit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    -- Foto do imóvel no pedido (ele pode mudar ou ser apagado).
    property_label VARCHAR(300),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    preferred_time VARCHAR(200) NOT NULL,
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'DONE', 'CANCELLED')),
    source VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_requests_tenant_created
    ON public.visit_requests (tenant_id, created_at DESC);

ALTER TABLE public.visit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visit_requests_deny_anon ON public.visit_requests;
CREATE POLICY visit_requests_deny_anon ON public.visit_requests
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS visit_requests_deny_authenticated ON public.visit_requests;
CREATE POLICY visit_requests_deny_authenticated ON public.visit_requests
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
