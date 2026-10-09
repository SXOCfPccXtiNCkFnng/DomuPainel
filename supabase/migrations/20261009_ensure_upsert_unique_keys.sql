-- Chaves únicas que os "upserts" do código usam (ON CONFLICT). Sem elas o
-- Postgres recusa a operação inteira ("no unique or exclusion constraint
-- matching the ON CONFLICT specification"):
--   - leads (tenant_id, phone): captura automática de contatos no webhook e
--     importação de contatos. Em produção ela não existia — 20260328_leads_unique_phone
--     não chegou a ser aplicada — e nenhum contato novo era criado.
--   - chat_messages (tenant_id, wamid): mensagens do atendimento sem duplicar.
-- Idempotente: pode rodar mais de uma vez.

-- Remove duplicados que impediriam o índice (mantém o mais antigo).
DELETE FROM public.leads a
USING public.leads b
WHERE a.tenant_id = b.tenant_id
  AND a.phone = b.phone
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_phone_uidx
    ON public.leads (tenant_id, phone);

DELETE FROM public.chat_messages a
USING public.chat_messages b
WHERE a.wamid IS NOT NULL
  AND a.tenant_id = b.tenant_id
  AND a.wamid = b.wamid
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_tenant_wamid
    ON public.chat_messages (tenant_id, wamid);
