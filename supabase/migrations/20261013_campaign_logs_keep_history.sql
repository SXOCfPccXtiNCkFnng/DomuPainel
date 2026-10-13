-- Histórico de campanha sobrevive à exclusão do contato.
-- Antes: campaign_logs.lead_id era ON DELETE CASCADE — excluir um contato
-- apagava os envios dele, e a campanha mostrava "1 de 2" enquanto o histórico
-- (contadores salvos) mostrava 2 enviados.
-- Agora cada envio guarda nome/telefone de quem recebeu, e excluir o contato
-- só desfaz o vínculo (lead_id = NULL).

ALTER TABLE public.campaign_logs ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE public.campaign_logs ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30);

-- Preenche os envios que já existem com os dados atuais do contato.
UPDATE public.campaign_logs l
SET recipient_name = le.name,
    recipient_phone = le.phone
FROM public.leads le
WHERE le.id = l.lead_id
  AND l.recipient_phone IS NULL;

ALTER TABLE public.campaign_logs ALTER COLUMN lead_id DROP NOT NULL;

-- Troca a FK (o nome pode variar entre bancos: procura pela relação).
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.campaign_logs'::regclass
    AND confrelid = 'public.leads'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.campaign_logs DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.campaign_logs
    ADD CONSTRAINT campaign_logs_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
END $$;

-- Lista de destinatários por campanha (tela de progresso, com filtro de status).
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_status
    ON public.campaign_logs (campaign_id, status, created_at DESC);
