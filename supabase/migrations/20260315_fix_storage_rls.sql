-- Ensure seller-logos bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-logos', 'seller-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "seller_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "seller_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "seller_logos_select" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read seller logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload seller logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update seller logos" ON storage.objects;

-- Allow any authenticated user to upload logos
CREATE POLICY "seller_logos_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seller-logos' AND auth.role() = 'authenticated');

-- Allow any authenticated user to update logos
CREATE POLICY "seller_logos_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'seller-logos' AND auth.role() = 'authenticated');

-- Allow public read access to logos
CREATE POLICY "seller_logos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'seller-logos');
