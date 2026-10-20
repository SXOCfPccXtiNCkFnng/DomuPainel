-- Cota da atendente de IA: conta as conversas (contato + dia em Brasília)
-- direto no banco. Ler as linhas de assistant_runs pela API parava em 1000
-- (limite do PostgREST) e a cota deixava de bloquear em contas movimentadas.

CREATE OR REPLACE FUNCTION public.assistant_conversation_counts(p_tenant_ids UUID[], p_since TIMESTAMPTZ)
RETURNS TABLE (tenant_id UUID, conversations BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.tenant_id,
         COUNT(DISTINCT (r.lead_id, (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date))
  FROM public.assistant_runs r
  WHERE r.tenant_id = ANY (p_tenant_ids)
    AND r.status = 'REPLIED'
    AND r.lead_id IS NOT NULL
    AND r.created_at >= p_since
  GROUP BY r.tenant_id;
$$;

REVOKE ALL ON FUNCTION public.assistant_conversation_counts(UUID[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_conversation_counts(UUID[], TIMESTAMPTZ) TO service_role;

CREATE INDEX IF NOT EXISTS idx_assistant_runs_tenant_status_created
    ON public.assistant_runs (tenant_id, status, created_at);
