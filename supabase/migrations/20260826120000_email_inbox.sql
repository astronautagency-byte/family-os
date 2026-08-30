-- Add email_token to households for unique forwarding addresses
ALTER TABLE households ADD COLUMN IF NOT EXISTS email_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Create email_inbox table for parsed forwarded emails
CREATE TABLE IF NOT EXISTS email_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  parsed_items JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_inbox ENABLE ROW LEVEL SECURITY;

-- Users can only see their household's emails
CREATE POLICY "Household members can view inbox" ON email_inbox
  FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Only service role can insert (via Edge Function)
CREATE POLICY "Service role can insert inbox" ON email_inbox
  FOR INSERT
  WITH CHECK (true);

-- Users can update status of their household's emails
CREATE POLICY "Household members can update inbox" ON email_inbox
  FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_email_inbox_household ON email_inbox(household_id, status, created_at DESC);

-- Function to get or create email token for a household
CREATE OR REPLACE FUNCTION get_household_email_token(hid UUID)
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  SELECT email_token INTO token FROM households WHERE id = hid;
  IF token IS NULL THEN
    token := encode(gen_random_bytes(16), 'hex');
    UPDATE households SET email_token = token WHERE id = hid;
  END IF;
  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve email token to household
CREATE OR REPLACE FUNCTION resolve_email_token(token TEXT)
RETURNS UUID AS $$
DECLARE
  hid UUID;
BEGIN
  SELECT id INTO hid FROM households WHERE email_token = token;
  RETURN hid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
