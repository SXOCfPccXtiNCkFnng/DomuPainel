-- Financeiro dos ramos com agenda (lava rápido, saúde e beleza).
-- Faturamento vem da agenda (preço gravado em cada agendamento); gastos e
-- outras entradas o dono lança à mão aqui.
--   kind: EXPENSE (gasto) · INCOME (entrada fora da agenda, ex.: venda de produto)
CREATE TABLE IF NOT EXISTS public.finance_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('EXPENSE', 'INCOME')),
    description VARCHAR(160) NOT NULL,
    category VARCHAR(40) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    occurred_on DATE NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_entries_tenant_date
    ON public.finance_entries (tenant_id, occurred_on);

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_entries_deny_anon ON public.finance_entries;
CREATE POLICY finance_entries_deny_anon ON public.finance_entries
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS finance_entries_deny_authenticated ON public.finance_entries;
CREATE POLICY finance_entries_deny_authenticated ON public.finance_entries
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Faturamento pela agenda de cada conta no período (painel /interno).
-- Mesma regra da tela: concluído, ou confirmado cujo horário já terminou.
CREATE OR REPLACE FUNCTION public.finance_revenue_by_tenant(p_since TIMESTAMPTZ, p_until TIMESTAMPTZ)
RETURNS TABLE (tenant_id UUID, revenue NUMERIC, appointments BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.tenant_id, COALESCE(SUM(a.price), 0), COUNT(*)
  FROM public.appointments a
  WHERE a.starts_at >= p_since
    AND a.starts_at < p_until
    AND (a.status = 'COMPLETED' OR (a.status = 'CONFIRMED' AND a.ends_at < NOW()))
  GROUP BY a.tenant_id;
$$;

REVOKE ALL ON FUNCTION public.finance_revenue_by_tenant(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_revenue_by_tenant(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
