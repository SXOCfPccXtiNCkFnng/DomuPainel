-- Prospecção (/interno): estabelecimentos encontrados no Google Places para a
-- equipe Domu oferecer a plataforma. Não pertence a nenhum tenant.
CREATE TABLE IF NOT EXISTS public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id VARCHAR(300) NOT NULL UNIQUE,
    name VARCHAR(300) NOT NULL,
    kind VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    city VARCHAR(120),
    address VARCHAR(500),
    phone VARCHAR(40),
    phone_intl VARCHAR(40),
    is_mobile BOOLEAN NOT NULL DEFAULT FALSE,
    website VARCHAR(1000),
    instagram VARCHAR(60),
    instagram_checked_at TIMESTAMP WITH TIME ZONE,
    maps_url VARCHAR(1000),
    rating NUMERIC(2,1),
    rating_count INT,
    business_status VARCHAR(40),
    search_city VARCHAR(120),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW','CONTACTED','REPLIED','INTERESTED','CLIENT','NOT_INTERESTED','INVALID')),
    notes VARCHAR(2000),
    contacted_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_kind_city ON public.prospects (kind, city);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects (status);

-- Cada busca (tipo + cidade) feita no Google, para não pagar de novo à toa.
CREATE TABLE IF NOT EXISTS public.prospect_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(50) NOT NULL,
    city VARCHAR(120) NOT NULL,
    result_count INT NOT NULL DEFAULT 0,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (kind, city)
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospects_deny_anon" ON public.prospects;
CREATE POLICY "prospects_deny_anon" ON public.prospects
    FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "prospects_deny_authenticated" ON public.prospects;
CREATE POLICY "prospects_deny_authenticated" ON public.prospects
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "prospect_searches_deny_anon" ON public.prospect_searches;
CREATE POLICY "prospect_searches_deny_anon" ON public.prospect_searches
    FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "prospect_searches_deny_authenticated" ON public.prospect_searches;
CREATE POLICY "prospect_searches_deny_authenticated" ON public.prospect_searches
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
