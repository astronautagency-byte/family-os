import { supabase } from "./supabase";

export async function partnerApply({ companyName, websiteUrl, contactName, industry, companySize, monthlyBudget }) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("partner_apply", {
    p_company_name: companyName,
    p_website_url: websiteUrl || "",
    p_contact_name: contactName || "",
    p_industry: industry || "",
    p_company_size: companySize || "",
    p_monthly_budget: monthlyBudget || "",
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyPartner() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_my_partner");
  if (error) {
    console.warn("[partner] get_my_partner failed:", error.message);
    return null;
  }
  return data || null;
}

export async function getMyCampaigns() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_my_campaigns");
  if (error) {
    console.warn("[partner] get_my_campaigns failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getCampaignMetrics(campaignId) {
  if (!supabase || !campaignId) return [];
  const { data, error } = await supabase.rpc("partner_campaign_metrics", { p_campaign_id: campaignId });
  if (error) {
    console.warn("[partner] partner_campaign_metrics failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getCampaignDaily(campaignId) {
  if (!supabase || !campaignId) return [];
  const { data, error } = await supabase.rpc("partner_campaign_daily", { p_campaign_id: campaignId });
  if (error) {
    console.warn("[partner] partner_campaign_daily failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function createCampaign(payload) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("partner_create_campaign", payload);
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCampaign(campaignId, payload) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("partner_update_campaign", { p_campaign_id: campaignId, ...payload });
  if (error) throw new Error(error.message);
}

export async function deleteCampaign(campaignId) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("partner_delete_campaign", { p_campaign_id: campaignId });
  if (error) throw new Error(error.message);
}

export async function toggleCampaign(campaignId, status) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("partner_toggle_campaign", { p_campaign_id: campaignId, p_status: status });
  if (error) throw new Error(error.message);
}

export async function syncCampaignSpend(campaignId) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("sync_campaign_spend", { p_campaign_id: campaignId });
  if (error) throw new Error(error.message);
}

export async function getMyInvoices() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_my_invoices");
  if (error) {
    console.warn("[partner] get_my_invoices failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getMyPayments() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_my_payments");
  if (error) {
    console.warn("[partner] get_my_payments failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getBillingSummary() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("partner_billing_summary");
  if (error) {
    console.warn("[partner] partner_billing_summary failed:", error.message);
    return null;
  }
  return data || null;
}

export async function getAnalyticsDaily() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("partner_analytics_daily");
  if (error) {
    console.warn("[partner] partner_analytics_daily failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getAnalyticsPlacement() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("partner_analytics_placement");
  if (error) {
    console.warn("[partner] partner_analytics_placement failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getAnalyticsTopCampaigns() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("partner_analytics_top_campaigns");
  if (error) {
    console.warn("[partner] partner_analytics_top_campaigns failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function uploadCreative(file, userId) {
  if (!supabase) throw new Error("Supabase not configured");
  const slug = `creative-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${slug}`;
  const contentType = file.type || "image/webp";
  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, file, { cacheControl: "31536000", contentType, upsert: false });
  if (error) throw error;
  const { data: publicData } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return publicData.publicUrl;
}
