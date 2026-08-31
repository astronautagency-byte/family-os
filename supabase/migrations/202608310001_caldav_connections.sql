-- CalDAV connections for Apple iCloud calendar two-way sync
-- Stores encrypted credentials and sync state per user

CREATE TABLE IF NOT EXISTS caldav_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  apple_id TEXT NOT NULL,
  app_password_encrypted TEXT NOT NULL, -- Encrypted app-specific password
  display_name TEXT DEFAULT 'Apple Calendar',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT, -- CalDAV sync token for incremental sync
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CalDAV calendars (discovered from the user's iCloud account)
CREATE TABLE IF NOT EXISTS caldav_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES caldav_connections(id) ON DELETE CASCADE,
  href TEXT NOT NULL, -- CalDAV calendar href
  display_name TEXT NOT NULL,
  color TEXT,
  is_selected BOOLEAN DEFAULT true,
  is_shared BOOLEAN DEFAULT false,
  ctag TEXT, -- Change tag for detecting updates
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE caldav_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE caldav_calendars ENABLE ROW LEVEL SECURITY;

-- Users can only see their own CalDAV connections
CREATE POLICY "Users can view own caldav connections"
  ON caldav_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own caldav connections"
  ON caldav_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own caldav connections"
  ON caldav_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own caldav connections"
  ON caldav_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Calendars follow connection ownership
CREATE POLICY "Users can view own caldav calendars"
  ON caldav_calendars FOR SELECT
  USING (connection_id IN (SELECT id FROM caldav_connections WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own caldav calendars"
  ON caldav_calendars FOR ALL
  USING (connection_id IN (SELECT id FROM caldav_connections WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_caldav_connections_user ON caldav_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_caldav_calendars_connection ON caldav_calendars(connection_id);
