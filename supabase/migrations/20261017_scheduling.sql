-- Agenda (segmento automotivo: lava rápido e estética automotiva).
-- Base do agendamento automático pelo WhatsApp: serviços com duração,
-- horário de funcionamento e os horários marcados.
--
-- Capacidade = 1 atendimento por vez: a duração de cada serviço ocupa a
-- agenda e dois agendamentos ativos nunca se sobrepõem (trava no banco,
-- vale também quando o robô marcar sozinho).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Configuração por conta. Horários no fuso de Brasília.
CREATE TABLE IF NOT EXISTS public.scheduling_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- 7 itens, índice 0 = domingo: {"enabled": true, "open": "08:00", "close": "18:00"}
    weekly_hours JSONB NOT NULL,
    slot_step_minutes INT NOT NULL DEFAULT 30 CHECK (slot_step_minutes IN (15, 30, 60)),
    min_notice_minutes INT NOT NULL DEFAULT 60 CHECK (min_notice_minutes BETWEEN 0 AND 2880),
    booking_horizon_days INT NOT NULL DEFAULT 14 CHECK (booking_horizon_days BETWEEN 1 AND 90),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Serviços oferecidos (lavagem simples, polimento, higienização...).
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 5 AND 720),
    price NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant
    ON public.services (tenant_id, active);

-- 3) Agendamentos.
--    status: CONFIRMED · COMPLETED · CANCELLED · NO_SHOW (faltou)
--    source: PANEL (marcado no painel) · WHATSAPP (marcado pelo robô)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    -- Foto do serviço no momento do agendamento (o serviço pode mudar ou sumir).
    service_name VARCHAR(120) NOT NULL,
    price NUMERIC(10, 2),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    vehicle VARCHAR(120),
    notes TEXT,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    source VARCHAR(20) NOT NULL DEFAULT 'PANEL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (ends_at > starts_at),
    CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status IN ('CONFIRMED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_starts
    ON public.appointments (tenant_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_lead
    ON public.appointments (tenant_id, lead_id);

-- Mesmo padrão das demais tabelas: só a API (service role) acessa.
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scheduling_settings', 'services', 'appointments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_anon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t || '_deny_anon', t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t || '_deny_authenticated', t
    );
  END LOOP;
END $$;
