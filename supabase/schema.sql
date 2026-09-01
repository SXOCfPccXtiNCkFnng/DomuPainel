-- ==============================================================================
-- DOMU TECH - SAAS MULTI-TENANT COMPLETE DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- Production Ready Schema for Dispatches, CRM, Inventory, Billing & AI
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 01. TENANTS (Empresas / Imobiliárias)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    segment VARCHAR(50) NOT NULL DEFAULT 'imobiliario', -- 'imobiliario', 'ecommerce', 'saude', 'marketing_apenas', 'geral'
    whatsapp_number VARCHAR(30),
    coexistence_status VARCHAR(30) DEFAULT 'CONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'NEEDS_CHECKIN'
    last_mobile_checkin_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logo_url TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'TRIAL'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 02. USERS (Usuários, Corretores e Atendentes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ADMIN', -- 'SUPER_ADMIN', 'ADMIN', 'BROKER', 'ATTENDANT'
    avatar_url TEXT,
    phone VARCHAR(30),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 03. TENANT_CREDENTIALS (Credenciais Meta API Criptografadas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    waba_id VARCHAR(100) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    encrypted_access_token TEXT NOT NULL, -- Token da Meta criptografado com AES-256
    token_encryption_iv VARCHAR(100) NOT NULL, -- Vetor de Inicialização para AES-256
    verify_token VARCHAR(100) NOT NULL,
    app_id VARCHAR(100),
    app_secret_encrypted TEXT,
    webhook_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 04. SUBSCRIPTIONS (Planos, Pagamentos e Assinaturas Asaas/Stripe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_tier VARCHAR(30) NOT NULL DEFAULT 'PRO', -- 'STARTER', 'PRO', 'ENTERPRISE'
    monthly_price_brl NUMERIC(10, 2) NOT NULL DEFAULT 497.00,
    monthly_message_limit INT DEFAULT 10000, -- Limite mensal de disparos do plano
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'
    payment_method VARCHAR(30) DEFAULT 'PIX', -- 'PIX', 'CREDIT_CARD'
    asaas_customer_id VARCHAR(100),
    asaas_subscription_id VARCHAR(100),
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 05. PROPERTIES (Catálogo de Imóveis / Produtos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'Apartamento', 'Casa', 'Cobertura', 'Lote', 'Comercial'
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    price NUMERIC(14, 2) NOT NULL,
    bedrooms INT DEFAULT 0,
    bathrooms INT DEFAULT 0,
    area_sqm NUMERIC(10, 2) DEFAULT 0,
    image_url TEXT,
    gallery_images JSONB DEFAULT '[]'::jsonb, -- Array de URLs de Imagens no Storage
    status VARCHAR(30) DEFAULT 'Disponível', -- 'Disponível', 'Reservado', 'Lançamento', 'Vendido'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 06. LEADS (Contatos, Opt-In & Funil de Vendas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    interest_segment VARCHAR(50),
    interest_property_type VARCHAR(50),
    budget_max NUMERIC(14, 2),
    opt_in BOOLEAN DEFAULT TRUE, -- Rastreamento de Opt-In Anti-Ban
    opt_in_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(40) DEFAULT 'NOVO', -- 'NOVO', 'EM_ATENDIMENTO', 'VISITA_AGENDADA', 'PROPOSTA', 'FECHADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 07. HSM_TEMPLATES (Templates de Mensagem Aprovados pela Meta API)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hsm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meta_template_id VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'MARKETING', -- 'MARKETING', 'UTILITY', 'AUTHENTICATION'
    language VARCHAR(10) DEFAULT 'pt_BR',
    status VARCHAR(30) DEFAULT 'APPROVED', -- 'APPROVED', 'PENDING', 'REJECTED'
    header_type VARCHAR(20) DEFAULT 'NONE', -- 'NONE', 'TEXT', 'IMAGE', 'DOCUMENT'
    header_content TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 08. CAMPAIGNS (Campanhas de Disparos em Massa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.hsm_templates(id),
    name VARCHAR(255) NOT NULL,
    segment VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'RUNNING', 'COMPLETED', 'PAUSED', 'FAILED'
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_leads INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 09. CAMPAIGN_LOGS (Logs Individuais de Envio por Lead)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    wamid VARCHAR(150), -- Message ID retornado pela Meta
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'
    error_code INT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 10. CHAT_MESSAGES (CRM Mensagens 1:1 do Atendimento WhatsApp)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    direction VARCHAR(15) NOT NULL, -- 'INBOUND', 'OUTBOUND'
    sender_type VARCHAR(20) DEFAULT 'AGENT', -- 'AGENT', 'BOT_AI', 'CUSTOMER'
    message_type VARCHAR(20) DEFAULT 'TEXT', -- 'TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'LOCATION'
    body TEXT,
    media_url TEXT,
    wamid VARCHAR(150),
    status VARCHAR(20) DEFAULT 'DELIVERED', -- 'SENT', 'DELIVERED', 'READ', 'FAILED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 11. MEDIA_STORAGE (Metadados de Upload de Imagens e Arquivos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.media_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- Caminho no Bucket do Supabase Storage
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    public_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 12. ACCESS_LOGS (Log de Auditoria e Acessos do Sistema)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'LOGIN', 'PLAN_UPGRADE', 'CREDENTIALS_UPDATE', 'CAMPAIGN_DISPATCH'
    ip_address VARCHAR(45),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM SEARCH & DISPATCH PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON public.properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign ON public.campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_wamid ON public.campaign_logs(wamid);
CREATE INDEX IF NOT EXISTS idx_chat_messages_lead ON public.chat_messages(lead_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MULTI-TENANT ISOLATION
-- ==============================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
