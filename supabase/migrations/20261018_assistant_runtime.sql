-- Assistente de IA respondendo no WhatsApp.
-- assistant_paused_until: até quando a IA fica quieta nesta conversa — quando
-- ela chama alguém da equipe. (Resposta da equipe pelo celular/painel também
-- pausa, mas isso é lido direto do histórico em chat_messages.)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assistant_paused_until TIMESTAMP WITH TIME ZONE;

-- Leitura do histórico recente por contato e da última resposta humana.
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_lead_created
    ON public.chat_messages (tenant_id, lead_id, created_at DESC);
