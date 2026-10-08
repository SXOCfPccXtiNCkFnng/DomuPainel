-- Incremento atômico dos contadores da campanha usado pelo webhook da Meta.
-- Antes o webhook lia o valor e gravava +1: com vários status chegando ao
-- mesmo tempo, incrementos se perdiam. Aqui o UPDATE soma no próprio banco.
CREATE OR REPLACE FUNCTION public.increment_campaign_counter(
    p_campaign_id UUID,
    p_field TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_field NOT IN ('sent_count', 'delivered_count', 'read_count', 'failed_count') THEN
        RAISE EXCEPTION 'campo inválido: %', p_field;
    END IF;

    -- Sem mexer em updated_at: ele marca atividade do disparo (o cron usa
    -- para achar campanhas paradas) e webhook não é atividade de disparo.
    EXECUTE format(
        'UPDATE public.campaigns SET %1$I = COALESCE(%1$I, 0) + 1 WHERE id = $1',
        p_field
    ) USING p_campaign_id;
END;
$$;

-- Só o backend (service role) chama; o PostgREST público não.
REVOKE ALL ON FUNCTION public.increment_campaign_counter(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_counter(UUID, TEXT) TO service_role;

-- Busca de mensagem inbound por wamid (deduplicação de reentrega da Meta).
CREATE INDEX IF NOT EXISTS idx_chat_messages_wamid ON public.chat_messages(wamid);
