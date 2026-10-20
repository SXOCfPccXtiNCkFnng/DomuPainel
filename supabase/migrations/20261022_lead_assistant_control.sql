-- Controle da atendente por contato (página Leads):
-- assistant_disabled: a atendente nunca responde este contato (até religar).
-- assistant_resumed_at: "devolver para a atendente" — respostas da equipe
--   antes deste momento não pausam mais a atendente nesse contato.
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS assistant_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS assistant_resumed_at TIMESTAMP WITH TIME ZONE;
