import { useEffect, useRef, useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { fetchAdsForPlacement, trackAdImpression } from "../lib/adNetwork";
import { useAuth } from "../context/AuthContext";

const PLACEMENT_LABEL = {
  home: "Home",
  calendar: "Calendar",
  meals: "Meal planner",
  shopping: "Shopping",
  tasks: "Tasks",
};

export default function NativeAdBanner({ placement, compact = false, className = "" }) {
  const { profile } = useAuth();
  const [ad, setAd] = useState(null);
  const [paid, setPaid] = useState(false);
  const seenRef = useRef(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setAd(null);
    setPaid(false);
    seenRef.current = false;
    trackedRef.current = false;
    fetchAdsForPlacement(placement).then(({ ads, paid: isPaid }) => {
      if (cancelled) return;
      setPaid(isPaid);
      if (ads && ads.length > 0) setAd(ads[0]);
    });
    return () => { cancelled = true; };
  }, [placement, profile?.id]);

  useEffect(() => {
    if (ad && !trackedRef.current && typeof IntersectionObserver !== "undefined") {
      const el = bannerRef.current;
      if (!el) return;
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trackedRef.current = true;
          trackAdImpression(ad.id, placement, false);
          observer.disconnect();
        }
      }, { threshold: 0.4 });
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, [ad, placement]);

  const bannerRef = useRef(null);
  if (paid || !ad) return null;

  const handleClick = () => {
    trackAdImpression(ad.id, placement, true);
    if (ad.cta_url) window.open(ad.cta_url, "_blank", "noopener");
  };

  return (
    <div
      ref={bannerRef}
      className={`native-ad ${compact ? "native-ad-compact" : ""} ${className}`}
      role="complementary"
      aria-label={`Sponsored content`}
    >
      <div className="native-ad-copy">
        <span className="native-ad-tag"><Sparkles size={11} /> Sponsored · {PLACEMENT_LABEL[placement] || placement}</span>
        {ad.headline && <strong className="native-ad-title">{ad.headline}</strong>}
        {ad.body_text && <p className="native-ad-body">{ad.body_text}</p>}
        <button type="button" className="native-ad-cta" onClick={handleClick}>
          {ad.cta_text || "Learn more"} <ExternalLink size={12} />
        </button>
      </div>
      {ad.image_url && (
        <div className="native-ad-media">
          <img src={ad.image_url} alt="" loading="lazy" />
        </div>
      )}
    </div>
  );
}