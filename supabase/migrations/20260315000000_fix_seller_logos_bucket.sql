-- Force bucket to be public (previous migration used ON CONFLICT DO NOTHING)
UPDATE storage.buckets SET public = true WHERE id = 'seller-logos';

-- Re-create bucket if it somehow doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-logos', 'seller-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Re-apply RLS policies (drop + create to ensure they exist)
DROP POLICY IF EXISTS "seller_logos_insert" ON storage.objects;
CREATE POLICY "seller_logos_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'seller-logos'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "seller_logos_update" ON storage.objects;
CREATE POLICY "seller_logos_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'seller-logos'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "seller_logos_select" ON storage.objects;
CREATE POLICY "seller_logos_select"
ON storage.objects FOR select
USING (
  bucket_id = 'seller-logos'
);
