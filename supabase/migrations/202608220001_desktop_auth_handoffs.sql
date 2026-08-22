-- Secure browser-to-desktop authentication handoffs.
-- Only the service role accesses this table from the edge function. Values are
-- hashed where possible; the short-lived session tokens are deleted after use.
CREATE TABLE IF NOT EXISTS public.desktop_auth_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  state_hash text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desktop_auth_handoffs_expiry_idx
  ON public.desktop_auth_handoffs (expires_at);

ALTER TABLE public.desktop_auth_handoffs ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: the edge function uses the service role and the
-- browser never queries this table directly.
REVOKE ALL ON TABLE public.desktop_auth_handoffs FROM anon, authenticated;
