-- 1) Imagem da campanha (modelo com imagem no topo): cada disparo usa a imagem
--    escolhida na campanha (ex.: a foto do imóvel ou do cliente).
ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS header_image_url TEXT CHECK (header_image_url IS NULL OR char_length(header_image_url) <= 1000);

-- 2) Limpeza: os 6 modelos "genéricos" sugeridos (nunca enviados para a Meta)
--    só poluíam a lista. Agora cada conta recebe os modelos do próprio ramo.
--    Só apaga os que nunca foram ativados na Meta e não são usados em campanha.
DELETE FROM public.hsm_templates t
WHERE t.status = 'SUGGESTED'
  AND t.meta_template_id IS NULL
  AND t.name IN (
      'boas_vindas_atendimento',
      'aviso_novidades_ofertas',
      'confirmacao_agendamento',
      'lembrete_compromisso',
      'retorno_solicitacao',
      'pesquisa_satisfacao_feedback'
  )
  AND NOT EXISTS (SELECT 1 FROM public.campaigns c WHERE c.template_id = t.id);

-- 3) Modelos com imagem novos por ramo: libera a criação mais uma vez para quem
--    já recebeu os modelos (só cria os que faltam; os existentes não mudam).
--    (Se a coluna não existir, rode antes 20261028_segment_templates.sql.)
UPDATE public.tenants SET templates_provisioned_at = NULL WHERE templates_provisioned_at IS NOT NULL;
