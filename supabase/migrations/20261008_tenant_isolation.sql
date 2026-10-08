-- Isolamento entre clientes — segunda camada, no próprio banco.

-- 1) Um número de WhatsApp (phone_number_id) só pode estar ligado a UMA conta.
--    O webhook identifica o dono de cada mensagem/status por ele; duas contas
--    com o mesmo número = dados de uma indo parar na outra.
--    Se já existirem duplicados, esta migration PARA com erro listando-os —
--    resolva manualmente (descubra qual conta é a dona real) e rode de novo.
DO $$
DECLARE
  dup RECORD;
  found BOOLEAN := FALSE;
BEGIN
  FOR dup IN
    SELECT phone_number_id, array_agg(tenant_id) AS tenants
    FROM public.tenant_credentials
    WHERE phone_number_id IS NOT NULL AND phone_number_id <> ''
    GROUP BY phone_number_id
    HAVING COUNT(*) > 1
  LOOP
    found := TRUE;
    RAISE WARNING 'phone_number_id % ligado a várias contas: %', dup.phone_number_id, dup.tenants;
  END LOOP;

  IF found THEN
    RAISE EXCEPTION 'Existem números de WhatsApp ligados a mais de uma conta (veja os avisos acima). Corrija antes de criar o índice único.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_credentials_phone_number_id
    ON public.tenant_credentials (phone_number_id)
    WHERE phone_number_id IS NOT NULL AND phone_number_id <> '';

-- 2) Storage: a policy de SELECT deixava QUALQUER pessoa com a chave anon
--    LISTAR todos os arquivos do bucket (imagens de campanha de todos os
--    clientes, por pasta de tenant). Bucket público já serve o arquivo pelo
--    link /object/public sem policy — o link que vai para o WhatsApp continua
--    funcionando; só a listagem deixa de existir.
DROP POLICY IF EXISTS "campaign_media_public_read" ON storage.objects;
