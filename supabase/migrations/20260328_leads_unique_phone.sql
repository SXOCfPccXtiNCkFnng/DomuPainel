-- Run once on existing Supabase projects so contact upserts don't create duplicates
CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_phone_uidx
  ON public.leads (tenant_id, phone);
