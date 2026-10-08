-- Valores das variáveis do template escolhidos na criação da campanha.
-- Antes o disparo colocava o NOME do contato em TODAS as variáveis
-- ("sua consulta é Maria às Maria"). Formato: lista na ordem das variáveis,
-- ex.: [{"source":"contact_name"},{"source":"fixed","value":"15/10"}].
ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS template_params JSONB;
