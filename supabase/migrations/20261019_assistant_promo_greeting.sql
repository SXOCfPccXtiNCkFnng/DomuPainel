-- Atendente de IA: promoção com validade (some sozinha depois da data) e
-- mensagem de boas-vindas da loja. Mesmo padrão dos outros campos: texto do
-- dono entra no bloco de DADOS do prompt, nunca como instrução.
ALTER TABLE public.assistant_settings
    ADD COLUMN IF NOT EXISTS promo_text TEXT CHECK (promo_text IS NULL OR char_length(promo_text) <= 300),
    ADD COLUMN IF NOT EXISTS promo_until DATE,
    ADD COLUMN IF NOT EXISTS greeting TEXT CHECK (greeting IS NULL OR char_length(greeting) <= 200);
