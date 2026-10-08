-- Separa o RAMO do negócio do MODO da conta.
-- tenants.segment continua dizendo como o painel funciona hoje
-- ('marketing_apenas' = Somente Disparos, ou o módulo do ramo).
-- tenants.business_segment guarda o ramo real (imobiliario, saude,
-- alimentacao...) mesmo para quem começou no Somente Disparos — assim, ao
-- assinar Pro/Enterprise, a conta cai direto no módulo certo do ramo dela.
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS business_segment VARCHAR(50);

-- Contas que já estão num módulo de ramo: o ramo é o próprio segmento.
UPDATE public.tenants
SET business_segment = segment
WHERE business_segment IS NULL
  AND segment IS NOT NULL
  AND segment <> 'marketing_apenas';
