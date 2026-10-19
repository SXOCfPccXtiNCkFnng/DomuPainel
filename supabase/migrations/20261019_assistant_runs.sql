-- Cada vez que a atendente de IA roda numa conversa: resultado, tokens,
-- custo, tempo e sinais de "conferir esta resposta". Base das métricas e
-- do monitor de conversas do /interno. Só o servidor (service role) acessa.
CREATE TABLE IF NOT EXISTS public.assistant_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id UUID,
  trigger_message_id UUID,
  -- REPLIED | SKIPPED | NO_REPLY | FAILED | SUPERSEDED
  status VARCHAR(20) NOT NULL,
  -- Por que não respondeu (pausa, limite, opt-out) ou onde falhou.
  reason VARCHAR(60),
  model VARCHAR(60),
  ai_calls INT NOT NULL DEFAULT 0,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cached_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  -- Mesmo consumo no preço cheio do modelo (sem promoção) — para precificar.
  cost_usd_full NUMERIC(12, 6) NOT NULL DEFAULT 0,
  -- Tempo da IA (sem a espera de o cliente terminar de digitar).
  ai_ms INT,
  -- Da mensagem do cliente até a resposta chegar.
  response_ms INT,
  tools TEXT[] NOT NULL DEFAULT '{}',
  tool_errors INT NOT NULL DEFAULT 0,
  booked BOOLEAN NOT NULL DEFAULT FALSE,
  handoff BOOLEAN NOT NULL DEFAULT FALSE,
  bubbles INT NOT NULL DEFAULT 0,
  flags TEXT[] NOT NULL DEFAULT '{}',
  customer_message TEXT,
  reply_text TEXT,
  error TEXT,
  -- Revisão manual no /interno: OK | BAD
  review_status VARCHAR(10),
  review_note TEXT,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_runs_created ON public.assistant_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_tenant_created ON public.assistant_runs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_lead ON public.assistant_runs (tenant_id, lead_id, created_at DESC);

ALTER TABLE public.assistant_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assistant_runs' AND policyname = 'deny_all_assistant_runs'
  ) THEN
    CREATE POLICY deny_all_assistant_runs ON public.assistant_runs
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
