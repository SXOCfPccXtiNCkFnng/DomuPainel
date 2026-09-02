-- Starter MVP: tags de região + vínculo campanha ↔ imóvel
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS region VARCHAR(100);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_region ON public.leads(region);
CREATE INDEX IF NOT EXISTS idx_leads_interest ON public.leads(interest_segment);
CREATE INDEX IF NOT EXISTS idx_campaigns_property ON public.campaigns(property_id);
