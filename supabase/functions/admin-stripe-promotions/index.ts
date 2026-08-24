import Stripe from "npm:stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function authorize(request: Request) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!stripeKey || !supabaseUrl || !serviceKey || !token) throw new Error("Server is misconfigured.");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) throw new Error("Sign-in required.");
  const { data: operator } = await admin.from("admin_users").select("email,is_active").eq("user_id", auth.user.id).maybeSingle();
  if (!operator?.is_active) throw new Error("Admin access required.");
  return { admin, stripe: new Stripe(stripeKey, { apiVersion: "2024-06-20" }), user: auth.user, operator };
}

const mapPromotionCode = (promotion: Stripe.PromotionCode, coupon?: Stripe.Coupon) => ({
  id: promotion.id,
  name: coupon?.name || promotion.code,
  discountType: coupon?.percent_off ? "percentage" : "fixed_amount",
  discountPercentage: coupon?.percent_off || null,
  discountAmount: coupon?.amount_off || null,
  currency: coupon?.currency?.toUpperCase() || "CAD",
  durationType: coupon?.duration || "once",
  redemptions: promotion.times_redeemed || 0,
  maxRedemptions: promotion.max_redemptions || null,
  validTill: promotion.expires_at ? new Date(promotion.expires_at * 1000).toISOString() : null,
  status: promotion.active ? "active" : "archived",
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  try {
    const { admin, stripe, user, operator } = await authorize(request);
    const body = await request.json().catch(() => ({}));
    if (body.action === "list") {
      const promotions = await stripe.promotionCodes.list({ limit: 100, expand: ["data.coupon"] });
      return reply({ coupons: promotions.data.map((item) => mapPromotionCode(item, typeof item.coupon !== "string" ? item.coupon : undefined)), stripeUrl: "https://dashboard.stripe.com" });
    }
    if (body.action === "archive") {
      if (!body.couponId) return reply({ error: "Promotion is required." }, 400);
      await stripe.promotionCodes.update(String(body.couponId), { active: false });
      await admin.from("admin_audit_log").insert({ admin_user_id: user.id, admin_email: operator.email, action: "archive_stripe_promotion", target_type: "stripe_promotion_code", target_id: String(body.couponId), details: {} });
      return reply({ archived: true });
    }
    if (body.action === "create") {
      const code = String(body.code || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      if (code.length < 3 || name.length < 2) return reply({ error: "A code and internal name are required." }, 400);
      const couponParams: Stripe.CouponCreateParams = {
        name,
        duration: body.durationType === "forever" ? "forever" : body.durationType === "limited_period" ? "repeating" : "once",
        currency: "cad",
      };
      if (couponParams.duration === "repeating") couponParams.duration_in_months = Math.max(1, Number(body.period || 1));
      if (body.discountType === "percentage") couponParams.percent_off = Math.min(100, Math.max(0.01, Number(body.discountPercentage || 0)));
      else couponParams.amount_off = Math.max(1, Math.round(Number(body.discountAmount || 0)));
      const coupon = await stripe.coupons.create(couponParams);
      const promotion = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        max_redemptions: body.maxRedemptions ? Math.max(1, Number(body.maxRedemptions)) : undefined,
        expires_at: body.validTill ? Math.floor(new Date(body.validTill).getTime() / 1000) : undefined,
      });
      await admin.from("admin_audit_log").insert({ admin_user_id: user.id, admin_email: operator.email, action: "create_stripe_promotion", target_type: "stripe_promotion_code", target_id: promotion.id, details: { code, couponId: coupon.id } });
      return reply({ promotion: mapPromotionCode(promotion, coupon) });
    }
    return reply({ error: "Unknown promotion action." }, 400);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Stripe promotion request failed." }, 500);
  }
});
