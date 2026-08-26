import { useEffect, useState } from "react";
import { Megaphone, Sparkles, Check, Wrench, ChevronRight, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ICONS = {
  sparkles: Sparkles,
  megaphone: Megaphone,
  wrench: Wrench,
};

const CATEGORY_COLORS = {
  update: { bg: "color-mix(in srgb, var(--color-accent-soft) 60%, white)", accent: "var(--color-accent-strong)", border: "var(--color-accent)" },
  feature: { bg: "color-mix(in srgb, #dff5e9 60%, white)", accent: "#1a7a4c", border: "#228766" },
  fix: { bg: "color-mix(in srgb, #fff0a8 60%, white)", accent: "#9a7b18", border: "#d4a843" },
};

export default function ProductUpdateBanner() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data: unseen } = await supabase
          .from("product_updates")
          .select("id, title, summary, category, icon, link_url, link_label, published_at")
          .eq("is_active", true)
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(3);

        if (cancelled || !unseen?.length) return;

        // Check which ones the user has already seen
        const { data: reads } = await supabase
          .from("product_update_reads")
          .select("update_id, dismissed")
          .eq("user_id", user.id);

        const readMap = new Map((reads || []).map((r) => [r.update_id, r.dismissed]));
        const unseenUpdates = unseen.filter((u) => !readMap.has(u.id) || !readMap.get(u.id));

        if (!cancelled) setUpdates(unseenUpdates.slice(0, 2));
      } catch { /* silent */ }
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

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
            className="product-update-banner"
            style={{
              background: colors.bg,
              borderLeft: `3px solid ${colors.border}`,
            }}
          >
            <div className="product-update-icon" style={{ color: colors.accent }}>
              <IconComponent size={16} />
            </div>
            <div className="product-update-body">
              <strong style={{ color: colors.accent }}>{update.title}</strong>
              <span>{update.summary}</span>
              {update.link_url && (
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
