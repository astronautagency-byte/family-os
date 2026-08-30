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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload support screenshots' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload support screenshots"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'support-screenshots');
  END IF;
END $$;

-- Allow public read access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access for support screenshots' AND tablename = 'objects') THEN
    CREATE POLICY "Public read access for support screenshots"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'support-screenshots');
  END IF;
END $$;

-- Allow authenticated users to delete their own uploads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own support screenshots' AND tablename = 'objects') THEN
    CREATE POLICY "Users can delete own support screenshots"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'support-screenshots');
  END IF;
END $$;
