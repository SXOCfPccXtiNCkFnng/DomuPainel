-- Auth tokens + invites (password reset / team invites)
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON public.password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.user_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ATTENDANT',
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_invites_tenant ON public.user_invites(tenant_id);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS password_reset_tokens_deny_anon ON public.password_reset_tokens;
  CREATE POLICY password_reset_tokens_deny_anon ON public.password_reset_tokens
    FOR ALL TO anon USING (false) WITH CHECK (false);
  DROP POLICY IF EXISTS password_reset_tokens_deny_authenticated ON public.password_reset_tokens;
  CREATE POLICY password_reset_tokens_deny_authenticated ON public.password_reset_tokens
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

  DROP POLICY IF EXISTS user_invites_deny_anon ON public.user_invites;
  CREATE POLICY user_invites_deny_anon ON public.user_invites
    FOR ALL TO anon USING (false) WITH CHECK (false);
  DROP POLICY IF EXISTS user_invites_deny_authenticated ON public.user_invites;
  CREATE POLICY user_invites_deny_authenticated ON public.user_invites
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
END $$;
