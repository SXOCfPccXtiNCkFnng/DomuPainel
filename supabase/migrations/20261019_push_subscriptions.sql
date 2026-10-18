-- Notificações no celular (web push). Cada linha é um aparelho/navegador em
-- que o usuário ativou as notificações. O endpoint é único: se outra pessoa
-- entrar no mesmo aparelho e ativar, o aparelho passa a ser dela.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
    p256dh TEXT NOT NULL CHECK (char_length(p256dh) <= 200),
    auth TEXT NOT NULL CHECK (char_length(auth) <= 100),
    user_agent VARCHAR(300),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_user
    ON public.push_subscriptions (tenant_id, user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_deny_anon" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_deny_anon" ON public.push_subscriptions
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "push_subscriptions_deny_authenticated" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_deny_authenticated" ON public.push_subscriptions
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
