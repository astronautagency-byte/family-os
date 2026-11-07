import { useEffect, useState } from "react";
import { Megaphone, Sparkles, MapPin, Wrench, ChevronRight, X } from "./icons";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ICONS = {
  sparkles: Sparkles,
  megaphone: Megaphone,
  wrench: Wrench,
  location: MapPin,
};

export const LOCATION_UPDATE_ID = "bb76980f-c1a6-47e8-b53e-d59a58d24021";

const CATEGORY_COLORS = {
  update: { bg: "color-mix(in srgb, var(--color-accent-soft) 60%, white)", accent: "var(--color-accent-strong)", border: "var(--color-accent)" },
  feature: { bg: "color-mix(in srgb, #dff5e9 60%, white)", accent: "#1a7a4c", border: "#228766" },
  fix: { bg: "color-mix(in srgb, #fff0a8 60%, white)", accent: "#9a7b18", border: "#d4a843" },
};

export default function ProductUpdateBanner({ locationOnly = false, onNavigate }) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        let query = supabase
          .from("product_updates")
          .select("id, title, summary, category, icon, link_url, link_label, published_at")
          .eq("is_active", true)
          .not("published_at", "is", null);
        query = locationOnly ? query.eq("id", LOCATION_UPDATE_ID) : query.neq("id", LOCATION_UPDATE_ID);
        const { data: unseen } = await query.order("published_at", { ascending: false }).limit(3);

        if (cancelled || !unseen?.length) return;

        // Check which ones the user has already seen
        const { data: reads, error: readError } = await supabase
          .from("product_update_reads")
          .select("update_id, dismissed")
          .eq("user_id", user.id);

        if (readError) return;
        const readMap = new Map((reads || []).map((r) => [r.update_id, r.dismissed]));
        const unseenUpdates = unseen.filter((u) => !readMap.has(u.id) || !readMap.get(u.id));

        if (!cancelled) setUpdates(unseenUpdates.slice(0, 2));
      } catch { /* silent */ }
    };

    load();
    return () => { cancelled = true; };
  }, [user, locationOnly]);

  const dismiss = async (updateId) => {
    setDismissed((prev) => new Set([...prev, updateId]));
    if (user) {
      try {
        await supabase.from("product_update_reads").upsert(
          { update_id: updateId, user_id: user.id, dismissed: true, read_at: new Date().toISOString() },
          { onConflict: "update_id,user_id" }
        );
      } catch { /* best effort */ }
    }
  };

  const markRead = async (updateId) => {
    if (user) {
      try {
        await supabase.from("product_update_reads").upsert(
          { update_id: updateId, user_id: user.id, read_at: new Date().toISOString() },
          { onConflict: "update_id,user_id" }
        );
      } catch { /* best effort */ }
    }
  };

  const visible = updates.filter((u) => !dismissed.has(u.id));
  if (!visible.length) return null;

  return (
    <div className="product-updates-stack" role="status" aria-label="Product updates">
      {visible.map((update) => {
        const colors = CATEGORY_COLORS[update.category] || CATEGORY_COLORS.update;
        const IconComponent = ICONS[update.icon] || Sparkles;
        return (
          <div
            key={update.id}
            className={`product-update-banner ${locationOnly ? "location-update-banner" : ""}`}
            style={locationOnly ? undefined : {
              background: colors.bg,
              borderLeft: `3px solid ${colors.border}`,
            }}
          >
            <div className="product-update-icon" style={{ color: colors.accent }}>
              {locationOnly ? <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><path d="M24 40S11 28 11 19a13 13 0 0 1 26 0c0 9-13 21-13 21Z" fill="#eeaa83" stroke="#96503a" strokeWidth="2"/><circle cx="24" cy="19" r="5" fill="#fff9ee"/><path d="M7 10l1.3-3.2L11.5 5.5 8.3 4.2 7 1 5.7 4.2 2.5 5.5l3.2 1.3L7 10Zm34 25 1-2.5 2.5-1-2.5-1-1-2.5-1 2.5-2.5 1 2.5 1L41 35Z" fill="#e5a52f"/></svg> : <IconComponent size={16} />}
            </div>
            <div className="product-update-body">
              <strong style={locationOnly ? undefined : { color: colors.accent }}>{update.title}</strong>
              <span>{update.summary}</span>
              {locationOnly && onNavigate ? (
                <button type="button" className="product-update-link location-update-link" onClick={() => { void dismiss(update.id); onNavigate("location"); }}>
                  {update.link_label || "Explore family location"} <ChevronRight size={15} />
                </button>
              ) : update.link_url && (
                <a
                  href={update.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markRead(update.id)}
                  className="product-update-link"
                  style={{ color: colors.accent }}
                >
                  {update.link_label || "Learn more"} <ChevronRight size={12} />
                </a>
              )}
            </div>
            <button
              type="button"
              className="product-update-dismiss"
              onClick={() => dismiss(update.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
