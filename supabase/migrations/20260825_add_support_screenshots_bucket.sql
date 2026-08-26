-- Create a public storage bucket for support screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-screenshots',
  'support-screenshots',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload support screenshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'support-screenshots');

-- Allow public read access
CREATE POLICY "Public read access for support screenshots"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'support-screenshots');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own support screenshots"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'support-screenshots');
