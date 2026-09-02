-- ==============================================================================
-- Domu Tech - RLS: deny PostgREST anon/authenticated (app uses service_role only)
-- Service role bypasses RLS. Run after schema.sql if policies are missing.
-- ==============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants',
    'users',
    'tenant_credentials',
    'subscriptions',
    'properties',
    'leads',
    'hsm_templates',
    'campaigns',
    'campaign_logs',
    'chat_messages',
    'media_storage',
    'access_logs',
    'notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_anon', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t || '_deny_anon',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t || '_deny_authenticated',
      t
    );
  END LOOP;
END $$;
