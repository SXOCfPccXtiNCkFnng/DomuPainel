-- Bucket público para mídia de campanhas (rodar no SQL Editor do Supabase)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-media',
  'campaign-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública; escrita só via service_role (API Next.js)
DROP POLICY IF EXISTS "campaign_media_public_read" ON storage.objects;
CREATE POLICY "campaign_media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'campaign-media');
