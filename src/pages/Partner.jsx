import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, ChevronRight, Copy, ExternalLink, Globe2, Landmark, LayoutDashboard, MapPin, Megaphone, Pencil, Plus, RefreshCw, Sparkles, Target, Trash2, TrendingUp, Upload, Users, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  getMyPartner,
  getMyCampaigns,
  getCampaignMetrics,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  uploadCreative,
} from "../lib/partnerApi";
import { AD_PLACEMENTS } from "../lib/adNetwork";

const PLACEMENT_LABELS = {
  [AD_PLACEMENTS.HOME]: "Home",
  [AD_PLACEMENTS.CALENDAR]: "Calendar",
  [AD_PLACEMENTS.MEALS]: "Meals",
  [AD_PLACEMENTS.SHOPPING]: "Shopping",
  [AD_PLACEMENTS.TASKS]: "Tasks",
};
const PLACEMENT_ICONS = {
  [AD_PLACEMENTS.HOME]: LayoutDashboard,
  [AD_PLACEMENTS.CALENDAR]: CalendarDays,
  [AD_PLACEMENTS.MEALS]: Sparkles,
  [AD_PLACEMENTS.SHOPPING]: Landmark,
  [AD_PLACEMENTS.TASKS]: Target,
};

const PRODUCT_CATEGORIES = [
  "Groceries & snacks",
  "Dairy & eggs",
  "Meat & seafood",
  "Produce",
  "Baby & kids",
  "Household & cleaning",
  "Personal care",
  "Vitamins & wellness",
  "Toys & games",
  "Services & memberships",
];

const STATUS_LABEL = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

const EMPTY_FORM = {
  name: "",
  headline: "",
  body_text: "",
  cta_text: "Learn more",
  cta_url: "",
  image_url: "",
  imageFile: null,
  placements: [AD_PLACEMENTS.HOME],
  product_categories: [],
  target_family_min: "",
  target_family_max: "",
  target_countries: [],
  target_regions: [],
  target_cities: [],
  target_postal_codes: [],
  start_date: "",
  end_date: "",
  budget_cents: "50000",
  status: "draft",
};

function PartnerLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("signin");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      onSignedIn();
    } catch (err) {
      setError(err.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="partner-login">
      <div className="partner-login-card">
        <div className="partner-brand">
          <Megaphone size={20} />
          <div><strong>FamOS Partners</strong><small>Reach families who plan their week in one place.</small></div>
        </div>
        <form onSubmit={submit}>
          <label className="partner-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" required autoComplete="email" />
          </label>
          <label className="partner-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </label>
          {error && <p className="partner-error" role="alert">{error}</p>}
          <button className="partner-primary-btn" type="submit" disabled={busy || !email || !password}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in to dashboard" : "Create partner account"}
          </button>
        </form>
        <button type="button" className="partner-switch-mode" onClick={() => setMode((current) => current === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "New advertiser? Create an account" : "Already a partner? Sign in"}
        </button>
      </div>
    </div>
  );
}

function MiniChart({ points }) {
  const values = points || [];
  const max = Math.max(...values, 1);
  return (
    <div className="partner-mini-chart" aria-hidden="true">
      {values.map((value, index) => {
        const height = Math.max(6, Math.round((value / max) * 56));
        return <i key={index} style={{ height }} />;
      })}
    </div>
  );
}

function CampaignCard({ campaign, onOpen }) {
  const Icon = PLACEMENT_ICONS[campaign.placements?.[0]] || Sparkles;
  const ctr = campaign.ctr_pct ?? (campaign.impressions ? (campaign.clicks / campaign.impressions) * 100 : 0);
  return (
    <button type="button" className="partner-campaign-card" onClick={() => onOpen(campaign)}>
      <div className="partner-campaign-top">
        <span className="partner-campaign-icon"><Icon size={15} /></span>
        <span className={`partner-status partner-status-${campaign.status}`}>{STATUS_LABEL[campaign.status] || campaign.status}</span>
      </div>
      <strong className="partner-campaign-name">{campaign.name}</strong>
      <p className="partner-campaign-headline">{campaign.headline}</p>
      <div className="partner-campaign-metrics">
        <span><strong>{campaign.impressions?.toLocaleString() || 0}</strong>Impressions</span>
        <span><strong>{campaign.clicks?.toLocaleString() || 0}</strong>Clicks</span>
        <span><strong>{Number(ctr || 0).toFixed(1)}%</strong>CTR</span>
      </div>
      <div className="partner-campaign-footer">
        <span className="partner-placement-tags">{campaign.placements?.map((key) => PLACEMENT_LABELS[key] || key).join(" · ")}</span>
        <ChevronRight size={15} />
      </div>
    </button>
  );
}

function CampaignSkeleton() {
  return <div className="partner-campaign-card is-skeleton"><span /><span /><span /></div>;
}

export default function Partner() {
  const [session, setSession] = useState(null);
  const [partner, setPartner] = useState(null);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [section, setSection] = useState("overview");
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selected, setSelected] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");

  const check = useCallback(async () => {
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    setSession(activeSession);
    if (!activeSession) { setAllowed(false); setChecking(false); return; }
    const me = await getMyPartner();
    if (me && (me.status === "active" || me.status === "pending")) {
      setPartner(me);
      setAllowed(true);
    } else {
      setAllowed(false);
    }
    setChecking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { check(); }, [check]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    const list = await getMyCampaigns();
    setCampaigns(list);
    setLoadingCampaigns(false);
  }, []);

  useEffect(() => {
    if (allowed) loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (selected?.id) {
      getCampaignMetrics(selected.id).then(setMetrics).catch(() => setMetrics([]));
    } else {
      setMetrics([]);
    }
  }, [selected]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_FORM });
    setSaveError("");
    setSection("editor");
  };

  const openEdit = (campaign) => {
    setEditing(campaign);
    setDraft({
      ...EMPTY_FORM,
      name: campaign.name,
      headline: campaign.headline,
      body_text: campaign.body_text,
      cta_text: campaign.cta_text,
      cta_url: campaign.cta_url,
      image_url: campaign.image_url,
      placements: campaign.placements || [],
      product_categories: campaign.product_categories || [],
      target_family_min: campaign.target_family_min ?? "",
      target_family_max: campaign.target_family_max ?? "",
      target_countries: campaign.target_countries || [],
      target_regions: campaign.target_regions || [],
      target_cities: campaign.target_cities || [],
      target_postal_codes: campaign.target_postal_codes || [],
      start_date: campaign.start_date ? campaign.start_date.slice(0, 10) : "",
      end_date: campaign.end_date ? campaign.end_date.slice(0, 10) : "",
      budget_cents: campaign.budget_cents,
      status: campaign.status,
    });
    setSaveError("");
    setSection("editor");
  };

  const save = async () => {
    setSaveError("");
    if (!draft.name.trim() || !draft.headline.trim() || !draft.cta_url.trim() || !draft.placements.length) {
      setSaveError("Name, headline, CTA URL, and at least one placement are required.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = draft.image_url;
      if (draft.imageFile) {
        imageUrl = await uploadCreative(draft.imageFile, session.user.id);
      }
      const payload = {
        p_name: draft.name,
        p_headline: draft.headline,
        p_body_text: draft.body_text,
        p_cta_text: draft.cta_text,
        p_cta_url: draft.cta_url,
        p_image_url: imageUrl,
        p_placements: draft.placements,
        p_product_categories: draft.product_categories,
        p_target_family_min: draft.target_family_min === "" ? null : Number(draft.target_family_min),
        p_target_family_max: draft.target_family_max === "" ? null : Number(draft.target_family_max),
        p_target_countries: draft.target_countries,
        p_target_regions: draft.target_regions,
        p_target_cities: draft.target_cities,
        p_target_postal_codes: draft.target_postal_codes,
        p_start_date: draft.start_date ? `${draft.start_date}T00:00:00Z` : null,
        p_end_date: draft.end_date ? `${draft.end_date}T23:59:59Z` : null,
        p_budget_cents: Number(draft.budget_cents) || 0,
        p_status: draft.status,
      };
      if (editing) {
        await updateCampaign(editing.id, payload);
        setToast("Campaign updated");
      } else {
        await createCampaign(payload);
        setToast("Campaign created — it will go live once approved");
      }
      setSection("overview");
      loadCampaigns();
    } catch (err) {
      setSaveError(err.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const togglePlacement = (key) => {
    setDraft((current) => ({
      ...current,
      placements: current.placements.includes(key)
        ? current.placements.filter((item) => item !== key)
        : [...current.placements, key],
    }));
  };

  const toggleProduct = (category) => {
    setDraft((current) => ({
      ...current,
      product_categories: current.product_categories.includes(category)
        ? current.product_categories.filter((item) => item !== category)
        : [...current.product_categories, category],
    }));
  };

  const toggleListValue = (key, value) => {
    setDraft((current) => {
      const list = current[key] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  };

  const totals = useMemo(() => {
    return campaigns.reduce((acc, campaign) => ({
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      spent: acc.spent + (campaign.spent_cents || 0),
    }), { impressions: 0, clicks: 0, spent: 0 });
  }, [campaigns]);

  const chartValues = useMemo(() => metrics.map((m) => m.impressions || 0), [metrics]);
  const last7 = useMemo(() => {
    if (!metrics.length) return [];
    return metrics.slice(-7).map((m) => m.impressions || 0);
  }, [metrics]);

  if (checking) {
    return <div className="partner-shell"><div className="partner-loading">Loading dashboard…</div></div>;
  }

  if (!session) {
    return <PartnerLogin onSignedIn={check} />;
  }

  if (!allowed) {
    return (
      <div className="partner-shell">
        <div className="partner-denied">
          <span className="partner-denied-icon"><ShieldCheckStop /></span>
          <h1>No partner account</h1>
          <p>This account isn't linked to an approved FamOS advertising partner. If you applied, please allow time for review — or reach out to partners@fam-os.app.</p>
          <button className="partner-secondary-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  const nav = [
    ["overview", "Campaigns", "overview" === section],
    ["editor", "New campaign", false],
  ];

  return (
    <div className="partner-shell">
      <header className="partner-topbar">
        <div className="partner-topbar-title">
          <span className="partner-topbar-logo"><Megaphone size={18} /></span>
          <div>
            <strong>FamOS Ad Partners</strong>
            <small>{partner?.company_name}</small>
          </div>
        </div>
        <div className="partner-topbar-actions">
          {partner?.status === "active" && <span className="partner-verified"><CheckCircle2 size={13} /> Verified partner</span>}
          <button className="partner-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <div className="partner-layout">
        <div className="partner-stats">
          <div><span>Total impressions</span><strong>{totals.impressions.toLocaleString()}</strong></div>
          <div><span>Total clicks</span><strong>{totals.clicks.toLocaleString()}</strong></div>
          <div><span>Avg CTR</span><strong>{(totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0).toFixed(1)}%</strong></div>
          <div><span>Est. spend</span><strong>{money(totals.spent)}</strong></div>
        </div>

        <div className="partner-content">
          <div className="partner-section-head">
            <div>
              <h1>Your campaigns</h1>
              <p>Create targeted ads that reach families based on placement, product interest, family size, and location.</p>
            </div>
            <button className="partner-primary-btn" onClick={openCreate}><Plus size={15} /> New campaign</button>
          </div>

          {toast && <div className="partner-toast">{toast}</div>}

          {selected ? (
            <div className="partner-detail">
              <div className="partner-detail-top">
                <button className="partner-back" onClick={() => setSelected(null)}>← All campaigns</button>
                <div className="partner-detail-actions">
                  <button className="partner-secondary-btn" onClick={() => openEdit(selected)}><Pencil size={13} /> Edit</button>
                  <button
                    className="partner-danger-btn"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${selected.name}"? This can't be undone.`)) return;
                      await deleteCampaign(selected.id);
                      setSelected(null);
                      loadCampaigns();
                      setToast("Campaign deleted");
                    }}
                  ><Trash2 size={13} /> Delete</button>
                </div>
              </div>

              <div className="partner-detail-hero">
                {selected.image_url && <img src={selected.image_url} alt="" />}
                <div>
                  <span className={`partner-status partner-status-${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
                  <h2>{selected.name}</h2>
                  <p>{selected.headline}</p>
                  {selected.body_text && <small>{selected.body_text}</small>}
                  <a className="partner-link" href={selected.cta_url} target="_blank" rel="noreferrer">{selected.cta_text} <ExternalLink size={12} /></a>
                </div>
              </div>

              <div className="partner-detail-grid">
                <div className="partner-kpi"><span>Impressions</span><strong>{selected.impressions?.toLocaleString() || 0}</strong></div>
                <div className="partner-kpi"><span>Clicks</span><strong>{selected.clicks?.toLocaleString() || 0}</strong></div>
                <div className="partner-kpi"><span>CTR</span><strong>{Number(selected.ctr_pct || 0).toFixed(2)}%</strong></div>
                <div className="partner-kpi"><span>Budget used</span><strong>{Number(selected.budget_used_pct || 0).toFixed(1)}%</strong></div>
              </div>

              <div className="partner-trend">
                <h3>Impressions · last {Math.max(chartValues.length, 1)} day{chartValues.length === 1 ? "" : "s"}</h3>
                <MiniChart points={last7} />
              </div>

              <div className="partner-targeting">
                <h3>Targeting</h3>
                <div className="partner-target-row">
                  <span><Target size={13} /> Placements</span>
                  <div>{selected.placements?.map((key) => <i key={key}>{PLACEMENT_LABELS[key] || key}</i>)}</div>
                </div>
                {selected.product_categories?.length > 0 && (
                  <div className="partner-target-row"><span><Sparkles size={13} /> Products</span><div>{selected.product_categories.map((c, index) => <i key={index}>{c}</i>)}</div></div>
                )}
                {(selected.target_family_min || selected.target_family_max) && (
                  <div className="partner-target-row"><span><Users size={13} /> Family size</span><div><i>{selected.target_family_min || "Any"}–{selected.target_family_max || "any"} people</i></div></div>
                )}
                {selected.target_countries?.length > 0 && (
                  <div className="partner-target-row"><span><Globe2 size={13} /> Countries</span><div>{selected.target_countries.map((c, index) => <i key={index}>{c}</i>)}</div></div>
                )}
                {selected.target_cities?.length > 0 && (
                  <div className="partner-target-row"><span><MapPin size={13} /> Cities</span><div>{selected.target_cities.map((c, index) => <i key={index}>{c}</i>)}</div></div>
                )}
              </div>
            </div>
          ) : section === "editor" ? (
            <div className="partner-editor">
              <div className="partner-editor-top">
                <h2>{editing ? "Edit campaign" : "Create campaign"}</h2>
                <button className="partner-back" onClick={() => setSection("overview")}><X size={15} /> Close</button>
              </div>

              <label className="partner-field">
                <span>Campaign name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Spring produce push" />
              </label>

              <div className="partner-field-row">
                <label className="partner-field">
                  <span>Headline</span>
                  <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="Fresh ideas start in the produce aisle" maxLength={200} />
                </label>
                <label className="partner-field">
                  <span>Body text (optional)</span>
                  <input value={draft.body_text} onChange={(e) => setDraft({ ...draft, body_text: e.target.value })} placeholder="A warm line to families at 6pm." />
                </label>
              </div>

              <div className="partner-field-row">
                <label className="partner-field">
                  <span>CTA text</span>
                  <input value={draft.cta_text} onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })} />
                </label>
                <label className="partner-field">
                  <span>CTA URL</span>
                  <input value={draft.cta_url} onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })} placeholder="https://brand.com/offer" type="url" />
                </label>
              </div>

              <div className="partner-upload-area">
                <span>Creative image</span>
                {draft.image_url ? (
                  <div className="partner-upload-preview">
                    <img src={draft.image_file_preview || draft.image_url} alt="" />
                    <button type="button" onClick={() => setDraft({ ...draft, image_url: "", imageFile: null })}><X size={14} /> Remove</button>
                  </div>
                ) : (
                  <label className="partner-upload-box">
                    <Upload size={18} />
                    <span>Upload image (JPEG / PNG / WebP, up to 5MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setDraft({ ...draft, imageFile: file, image_file_preview: URL.createObjectURL(file) });
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="partner-target-block">
                <h3><Target size={15} /> Placements</h3>
                <p>Where your ad appears for free-plan families.</p>
                <div className="partner-chip-list">
                  {Object.entries(PLACEMENT_LABELS).map(([key, label]) => {
                    const Icon = PLACEMENT_ICONS[key];
                    const active = draft.placements.includes(key);
                    return (
                      <button type="button" key={key} className={`partner-chip ${active ? "selected" : ""}`} onClick={() => togglePlacement(key)}>
                        <Icon size={14} /> {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="partner-target-block">
                <h3><Sparkles size={15} /> Product categories</h3>
                <p>Optional — limiting categories shows your ad to households most likely to care.</p>
                <div className="partner-chip-list">
                  {PRODUCT_CATEGORIES.map((category) => {
                    const active = draft.product_categories.includes(category);
                    return (
                      <button type="button" key={category} className={`partner-chip ${active ? "selected" : ""}`} onClick={() => toggleProduct(category)}>
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="partner-target-block">
                <h3><Users size={15} /> Family size (optional)</h3>
                <div className="partner-field-row partner-field-narrow">
                  <label className="partner-field">
                    <span>Min people</span>
                    <input type="number" min="1" max="30" value={draft.target_family_min} onChange={(e) => setDraft({ ...draft, target_family_min: e.target.value })} placeholder="Any" />
                  </label>
                  <label className="partner-field">
                    <span>Max people</span>
                    <input type="number" min="1" max="30" value={draft.target_family_max} onChange={(e) => setDraft({ ...draft, target_family_max: e.target.value })} placeholder="Any" />
                  </label>
                </div>
              </div>

              <div className="partner-target-block">
                <h3><Globe2 size={15} /> Location (optional)</h3>
                <div className="partner-field-row">
                  <label className="partner-field">
                    <span>Countries</span>
                    <input value={draft.target_countries.join(", ")} onChange={(e) => setDraft({ ...draft, target_countries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Canada, USA" />
                  </label>
                  <label className="partner-field">
                    <span>Regions / provinces</span>
                    <input value={draft.target_regions.join(", ")} onChange={(e) => setDraft({ ...draft, target_regions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Ontario, British Columbia" />
                  </label>
                </div>
                <div className="partner-field-row">
                  <label className="partner-field">
                    <span>Cities</span>
                    <input value={draft.target_cities.join(", ")} onChange={(e) => setDraft({ ...draft, target_cities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Toronto, Vancouver" />
                  </label>
                  <label className="partner-field">
                    <span>Postal codes</span>
                    <input value={draft.target_postal_codes.join(", ")} onChange={(e) => setDraft({ ...draft, target_postal_codes: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })} placeholder="M5V, V6B" />
                  </label>
                </div>
              </div>

              <div className="partner-target-block">
                <h3><CalendarDays size={15} /> Schedule & budget</h3>
                <div className="partner-field-row">
                  <label className="partner-field">
                    <span>Start date</span>
                    <input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
                  </label>
                  <label className="partner-field">
                    <span>End date</span>
                    <input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
                  </label>
                  <label className="partner-field">
                    <span>Budget (CAD)</span>
                    <input type="number" min="0" step="100" value={draft.budget_cents} onChange={(e) => setDraft({ ...draft, budget_cents: Math.round(Number(e.target.value) * 100) })} placeholder="500" />
                  </label>
                </div>
              </div>

              {saveError && <p className="partner-error" role="alert">{saveError}</p>}
              <div className="partner-editor-actions">
                <button className="partner-secondary-btn" onClick={() => setSection("overview")}>Cancel</button>
                <button className="partner-primary-btn" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create campaign"}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="partner-campaigns-list">
                {loadingCampaigns ? (
                  <>
                    <CampaignSkeleton />
                    <CampaignSkeleton />
                  </>
                ) : campaigns.length === 0 ? (
                  <div className="partner-empty">
                    <Megaphone size={26} />
                    <strong>No campaigns yet</strong>
                    <p>Create your first ad to start reaching families.</p>
                    <button className="partner-primary-btn" onClick={openCreate}><Plus size={15} /> New campaign</button>
                  </div>
                ) : (
                  campaigns.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} onOpen={setSelected} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ShieldCheckStop() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
      <path d="m14.5 9.5-5 5"></path>
      <path d="m9.5 9.5 5 5"></path>
    </svg>
  );
}