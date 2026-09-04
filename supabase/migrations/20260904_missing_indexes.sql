-- Índices para consultas que hoje fazem varredura completa da tabela.
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_budget_max ON public.leads(budget_max);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_direction ON public.chat_messages(tenant_id, direction);
-- Usado pelo gráfico de série diária em /relatorios (campaign_logs.sent_at por tenant).
CREATE INDEX IF NOT EXISTS idx_campaign_logs_tenant_sent ON public.campaign_logs(tenant_id, sent_at);
