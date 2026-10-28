-- Modelos de mensagem do ramo criados sozinhos na Meta assim que a conta tem
-- WhatsApp conectado e assinatura ativa. Marca quando isso já rodou, para
-- contas antigas receberem uma vez (sem chamar a Meta a cada visita na tela).
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS templates_provisioned_at TIMESTAMP WITH TIME ZONE;
