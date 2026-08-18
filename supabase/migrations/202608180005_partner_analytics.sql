-- ============================================================================
-- Partner Analytics RPCs
-- ============================================================================

-- Cross-campaign daily time series (last 30 days)
CREATE OR REPLACE FUNCTION public.partner_analytics_daily()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(d ORDER BY d.day)
    FROM (
      SELECT ai.created_at::date AS day,
             count(*) AS impressions,
             count(*) FILTER (WHERE ai.clicked) AS clicks,
             ROUND(sum(count(*)) OVER (ORDER BY ai.created_at::date) * 0 / 1) AS _unused
      FROM public.ad_impressions ai
      JOIN public.ad_campaigns c ON c.id = ai.campaign_id
      WHERE c.partner_id = v_partner
        AND ai.created_at >= now() - interval '30 days'
      GROUP BY ai.created_at::date
      ORDER BY ai.created_at::date
    ) d
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_analytics_daily() TO authenticated;

-- Placement breakdown
CREATE OR REPLACE FUNCTION public.partner_analytics_placement()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(p ORDER BY p.impressions DESC)
    FROM (
      SELECT ai.placement,
             count(*) AS impressions,
             count(*) FILTER (WHERE ai.clicked) AS clicks
      FROM public.ad_impressions ai
      JOIN public.ad_campaigns c ON c.id = ai.campaign_id
      WHERE c.partner_id = v_partner
      GROUP BY ai.placement
    ) p
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_analytics_placement() TO authenticated;

-- Top campaigns by impressions
CREATE OR REPLACE FUNCTION public.partner_analytics_top_campaigns()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT id INTO v_partner FROM public.ad_partners WHERE user_id = auth.uid() LIMIT 1;
  IF v_partner IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(c ORDER BY c.impressions DESC)
    FROM (
      SELECT id, name, status, impressions, clicks, spent_cents,
             CASE WHEN impressions > 0 THEN ROUND(clicks::numeric / impressions * 100, 1) ELSE 0 END AS ctr,
             CASE WHEN clicks > 0 THEN ROUND(spent_cents::numeric / clicks) ELSE 0 END AS cpc
      FROM public.ad_campaigns
      WHERE partner_id = v_partner
    ) c
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.partner_analytics_top_campaigns() TO authenticated;
