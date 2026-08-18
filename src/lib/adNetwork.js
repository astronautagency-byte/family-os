import { supabase } from "./supabase";

const impressionCache = new Map();

export const AD_PLACEMENTS = {
  HOME: "home",
  CALENDAR: "calendar",
  MEALS: "meals",
  SHOPPING: "shopping",
  TASKS: "tasks",
};

export const AD_SLOTS = new Map([
  ["home", { maxAds: 1, position: "top" }],
  ["calendar", { maxAds: 1, position: "below-grid" }],
  ["meals", { maxAds: 1, position: "below-header" }],
  ["shopping", { maxAds: 1, position: "below-header" }],
  ["tasks", { maxAds: 1, position: "below-header" }],
]);

const rotate = (ads) => {
  if (!ads || ads.length === 0) return [];
  const copy = [...ads];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export async function fetchAdsForPlacement(placement) {
  if (!supabase) return { paid: false, ads: [] };
  try {
    const { data, error } = await supabase.rpc("get_my_ads", { p_placement: placement });
    if (error) {
      console.warn("[ads] get_my_ads failed:", error.message);
      return { paid: false, ads: [] };
    }
    const result = data || {};
    return {
      paid: Boolean(result.paid),
      ads: rotate(result.ads || []),
    };
  } catch (err) {
    console.warn("[ads] unexpected error:", err.message);
    return { paid: false, ads: [] };
  }
}

export async function trackAdImpression(campaignId, placement, clicked = false) {
  if (!supabase || !campaignId || !placement) return;
  const key = `${campaignId}:${placement}`;
  if (impressionCache.has(key)) return;
  impressionCache.set(key, true);
  try {
    await supabase.rpc("record_ad_impression", {
      p_campaign_id: campaignId,
      p_placement: placement,
      p_clicked: clicked,
    });
  } catch (err) {
    console.warn("[ads] record impression failed:", err.message);
  }
}