-- 1) Mensagem do atendimento gravada em dobro.
--    O webhook conferia "já existe?" e depois inseria: duas reentregas da Meta
--    chegando juntas passavam as duas pela conferência. Com índice único o
--    banco recusa a segunda (o código insere com ON CONFLICT DO NOTHING).
--    Remove duplicados que já existam, mantendo a mensagem mais antiga.
DELETE FROM public.chat_messages a
USING public.chat_messages b
WHERE a.wamid IS NOT NULL
  AND a.tenant_id = b.tenant_id
  AND a.wamid = b.wamid
  AND (a.created_at, a.id) > (b.created_at, b.id);

-- Não-parcial de propósito: o upsert do PostgREST (ON CONFLICT) não usa índice
-- parcial. Linhas com wamid NULL continuam permitidas (NULL não conflita).
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_tenant_wamid
    ON public.chat_messages (tenant_id, wamid);

DROP INDEX IF EXISTS public.idx_chat_messages_wamid;

-- 2) Origem do contato: 'WHATSAPP' = criado sozinho quando a pessoa mandou
--    mensagem. NULL = cadastrado/importado antes desta coluna existir.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source VARCHAR(30);
