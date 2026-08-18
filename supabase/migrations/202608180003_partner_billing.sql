-- ============================================================================
-- Partner Billing + Spend Tracking
-- ============================================================================

-- Ensure cpm_cents column exists (from 202608180001, but defensive)
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS cpm_cents int NOT NULL DEFAULT 700 CHECK (cpm_cents >= 0);

-- Partner invoices: one per billing cycle
CREATE TABLE IF NOT EXISTS public.partner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.ad_partners(id) ON DELETE CASCADE,
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  total_impressions int NOT NULL DEFAULT 0,
  total_clicks int NOT NULL DEFAULT 0,
  cpm_cents int NOT NULL DEFAULT 700,
  subtotal_cents int NOT NULL DEFAULT 0,
  tax_cents int NOT NULL DEFAULT 0,
  total_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','void')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_invoices_partner_idx ON public.partner_invoices(partner_id, billing_period_start DESC);

-- Partner payments: records of actual payments
CREATE TABLE IF NOT EXISTS public.partner_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.ad_partners(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.partner_invoices(id) ON DELETE SET NULL,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL DEFAULT 'card' CHECK (method IN ('card','bank_transfer','manual')),
  reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_payments_partner_idx ON public.partner_payments(partner_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payments ENABLE ROW LEVEL SECURITY;

-- Partner invoices: partner-scoped read, admin full access
DROP POLICY IF EXISTS "partners read own invoices" ON public.partner_invoices;
CREATE POLICY "partners read own invoices"
ON public.partner_invoices FOR SELECT TO authenticated
USING (partner_id IN (SELECT p.id FROM public.ad_partners p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "admins manage invoices" ON public.partner_invoices;
CREATE POLICY "admins manage invoices"
ON public.partner_invoices FOR ALL TO authenticated
USING (public.is_famos_admin()) WITH CHECK (public.is_famos_admin());

-- Partner payments: partner-scoped read, admin full access
DROP POLICY IF EXISTS "partners read own payments" ON public.partner_payments;
CREATE POLICY "partners read own payments"
ON public.partner_payments FOR SELECT TO authenticated
USING (partner_id IN (SELECT p.id FROM public.ad_partners p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "admins manage payments" ON public.partner_payments;
CREATE POLICY "admins manage payments"
ON public.partner_payments FOR ALL TO authenticated
USING (public.is_famos_admin()) WITH CHECK (public.is_famos_admin());

-- ============================================================================
-- RPCs
-- ============================================================================

-- Sync a campaign's spend_cents based on impressions and CPM
CREATE OR REPLACE FUNCTION public.sync_campaign_spend(p_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cpm int;
  v_impressions int;
BEGIN
  SELECT cpm_cents, impressions INTO v_cpm, v_impressions
  FROM public.ad_campaigns WHERE id = p_campaign_id;

  UPDATE public.ad_campaigns
  SET spent_cents = ROUND(v_impressions * v_cpm / 1000.0),
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_campaign_spend(uuid) TO authenticated;

-- Get invoices for current partner
CREATE OR REPLACE FUNCTION public.get_my_invoices()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(inv ORDER BY inv.billing_period_start DESC)
    FROM public.partner_invoices inv
    WHERE inv.partner_id = v_partner
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_invoices() TO authenticated;

-- Get payment history for current partner
CREATE OR REPLACE FUNCTION public.get_my_payments()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(pay ORDER BY pay.created_at DESC)
    FROM public.partner_payments pay
    WHERE pay.partner_id = v_partner
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_payments() TO authenticated;

-- Partner billing summary: total spend, outstanding balance, next invoice estimate
CREATE OR REPLACE FUNCTION public.partner_billing_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
  v_total_impressions int := 0;
  v_total_clicks int := 0;
  v_total_spent_cents int := 0;
  v_outstanding_cents int := 0;
  v_campaign_count int := 0;
  v_active_count int := 0;
  v_avg_cpm int := 700;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN
    RETURN jsonb_build_object('total_impressions', 0, 'total_clicks', 0, 'total_spent_cents', 0,
      'outstanding_cents', 0, 'campaign_count', 0, 'active_count', 0, 'avg_cpm_cents', 700);
  END IF;

  SELECT
    coalesce(sum(impressions), 0),
    coalesce(sum(clicks), 0),
    coalesce(sum(spent_cents), 0),
    count(*),
    count(*) FILTER (WHERE status = 'active'),
    coalesce(nullif(avg(cpm_cents), 0), 700)
  INTO v_total_impressions, v_total_clicks, v_total_spent_cents, v_campaign_count, v_active_count, v_avg_cpm
  FROM public.ad_campaigns
  WHERE partner_id = v_partner;

  SELECT coalesce(sum(total_cents), 0)
  INTO v_outstanding_cents
  FROM public.partner_invoices
  WHERE partner_id = v_partner AND status = 'pending';

  RETURN jsonb_build_object(
    'total_impressions', v_total_impressions,
    'total_clicks', v_total_clicks,
    'total_spent_cents', v_total_spent_cents,
    'outstanding_cents', v_outstanding_cents,
    'campaign_count', v_campaign_count,
    'active_count', v_active_count,
    'avg_cpm_cents', v_avg_cpm
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_billing_summary() TO authenticated;

-- Campaign daily metrics with spend breakdown
CREATE OR REPLACE FUNCTION public.partner_campaign_daily(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
  v_cpm int;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RETURN '[]'::jsonb; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ad_campaigns WHERE id = p_campaign_id AND partner_id = v_partner) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT cpm_cents INTO v_cpm FROM public.ad_campaigns WHERE id = p_campaign_id;

  RETURN coalesce((
    SELECT jsonb_agg(d ORDER BY d.day)
    FROM (
      SELECT created_at::date AS day,
             count(*) AS impressions,
             count(*) FILTER (WHERE clicked) AS clicks,
             ROUND(count(*) * v_cpm / 1000.0) AS spend_cents
      FROM public.ad_impressions
      WHERE campaign_id = p_campaign_id
      GROUP BY created_at::date
      ORDER BY created_at::date
    ) d
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_campaign_daily(uuid) TO authenticated;

-- Bulk toggle campaign status (pause/resume)
CREATE OR REPLACE FUNCTION public.partner_toggle_campaign(p_campaign_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Partner access required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ad_campaigns WHERE id = p_campaign_id AND partner_id = v_partner) THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF p_status NOT IN ('active','paused','ended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.ad_campaigns SET status = p_status, updated_at = now() WHERE id = p_campaign_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_toggle_campaign(uuid, text) TO authenticated;
