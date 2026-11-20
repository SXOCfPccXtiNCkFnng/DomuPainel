-- Módulo Pizzaria e Delivery (segmento 'alimentacao').
-- Cardápio que a atendente de IA consulta, configuração de entrega/horário e
-- pedidos (feitos pela atendente no WhatsApp ou lançados pela equipe no painel).

-- 1) Cardápio.
--    prices: [{ "size": "Grande", "price": 59.9 }, ...] — size vazio = preço único.
--    allows_half: o sabor pode entrar em pizza meio a meio.
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(300),
    prices JSONB NOT NULL DEFAULT '[]'::jsonb,
    allows_half BOOLEAN NOT NULL DEFAULT FALSE,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON public.menu_items (tenant_id, active, category);

-- 2) Entrega, retirada e horário de funcionamento.
--    weekly_hours: 7 dias (0 = domingo) { enabled, open, close }; close menor
--    que open = fecha depois da meia-noite.
--    delivery_areas: [{ "area": "Centro", "fee": 5 }] — vazio = taxa única.
CREATE TABLE IF NOT EXISTS public.pizzeria_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    weekly_hours JSONB NOT NULL,
    delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    delivery_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
    min_order NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
    delivery_eta_min INT NOT NULL DEFAULT 50 CHECK (delivery_eta_min BETWEEN 5 AND 240),
    pickup_eta_min INT NOT NULL DEFAULT 30 CHECK (pickup_eta_min BETWEEN 5 AND 240),
    half_half_rule VARCHAR(10) NOT NULL DEFAULT 'MAIOR' CHECK (half_half_rule IN ('MAIOR', 'MEDIA')),
    max_flavors INT NOT NULL DEFAULT 2 CHECK (max_flavors BETWEEN 1 AND 4),
    notify_status BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) Pedidos.
--    items: [{ "description", "size", "flavors": [], "quantity", "unit_price", "total", "notes" }]
--    status: NOVO · EM_PREPARO · SAIU_ENTREGA · PRONTO_RETIRADA · ENTREGUE · CANCELADO
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_number INT NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    fulfillment VARCHAR(10) NOT NULL CHECK (fulfillment IN ('ENTREGA', 'RETIRADA')),
    address VARCHAR(400),
    area VARCHAR(100),
    payment_method VARCHAR(40),
    change_for NUMERIC(10, 2),
    notes VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'NOVO'
        CHECK (status IN ('NOVO', 'EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA', 'ENTREGUE', 'CANCELADO')),
    source VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    cancel_reason VARCHAR(200),
    status_notice VARCHAR(200),
    accepted_at TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON public.orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON public.orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_phone ON public.orders (tenant_id, customer_phone);

-- RLS: só o servidor (service_role) acessa.
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_items_deny_all ON public.menu_items;
CREATE POLICY menu_items_deny_all ON public.menu_items
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS pizzeria_settings_deny_all ON public.pizzeria_settings;
CREATE POLICY pizzeria_settings_deny_all ON public.pizzeria_settings
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS orders_deny_all ON public.orders;
CREATE POLICY orders_deny_all ON public.orders
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
