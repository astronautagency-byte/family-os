import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Copy, CreditCard,
  ExternalLink, Filter, Globe2, Landmark, LayoutDashboard, Link2, MapPin, Megaphone,
  MoreHorizontal, Pencil, Pause, Play, Plus, RefreshCw, Search, ShieldCheck, Sparkles,
  Target, Trash2, TrendingUp, Upload, Users, X, PieChart,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card } from "../components/ui";
import {
  getMyPartner,
  getMyCampaigns,
  getCampaignMetrics,
  getCampaignDaily,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaign,
  uploadCreative,
  getMyInvoices,
  getMyPayments,
  getBillingSummary,
  getAnalyticsDaily,
  getAnalyticsPlacement,
  getAnalyticsTopCampaigns,
  partnerApply,
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
  "Groceries & snacks", "Dairy & eggs", "Meat & seafood", "Produce",
  "Baby & kids", "Household & cleaning", "Personal care", "Vitamins & wellness",
  "Toys & games", "Services & memberships",
];
const STATUS_LABEL = { draft: "Draft", active: "Active", paused: "Paused", ended: "Ended" };
const STATUS_CLASSES = {
  draft: "status-draft", active: "status-active", paused: "status-paused", ended: "status-ended",
};
const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const pct = (num, den) => den ? ((num / den) * 100).toFixed(1) : "0.0";
const fmt = (n) => (n || 0).toLocaleString();

const EMPTY_FORM = {
  name: "", headline: "", body_text: "", cta_text: "Learn more", cta_url: "",
  image_url: "", imageFile: null, placements: [AD_PLACEMENTS.HOME],
  product_categories: [], target_family_min: "", target_family_max: "",
  target_countries: [], target_regions: [], target_cities: [],
  target_postal_codes: [], start_date: "", end_date: "",
  budget_cents: "50000", status: "draft", cpm_cents: "700",
};

/* ── Login / Signup ────────────────────────────────────────────────────── */

const INDUSTRIES = [
  "Groceries & food", "Baby & kids", "Household & cleaning", "Health & wellness",
  "Personal care", "Pet supplies", "Toys & games", "Clothing & apparel",
  "Electronics", "Education", "Restaurants & dining", "Services & subscriptions", "Other",
];
const BUDGET_RANGES = ["Under $500/mo", "$500–$2k/mo", "$2k–$5k/mo", "$5k–$10k/mo", "$10k+/mo", "Not sure yet"];
const COMPANY_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];

function PartnerShell({ children }) {
  return (
    <main className="minimal-auth">
      <div className="minimal-auth-inner">
        <img src="/brand/famos-logo.png" alt="FamOS" className="minimal-auth-logo" />
        {children}
      </div>
    </main>
  );
}

function PartnerLogin({ onSignedIn }) {
  const [step, setStep] = useState("auth"); // auth | profile | pending
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Company profile fields
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) throw signUpErr;
      setStep("profile");
    } catch (err) { setError(err.message || "Sign-up failed"); }
    finally { setBusy(false); }
  };

  const handleSignIn = async () => {
    setError("");
    setBusy(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      onSignedIn();
    } catch (err) { setError(err.message || "Sign-in failed"); }
    finally { setBusy(false); }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setError("");
    if (!companyName.trim()) { setError("Company name is required"); return; }
    setBusy(true);
    try {
      const result = await partnerApply({ companyName, websiteUrl, contactName: "", industry, companySize, monthlyBudget });
      if (result?.status === "active") {
        onSignedIn();
      } else {
        setStep("pending");
      }
    } catch (err) { setError(err.message || "Application failed"); }
    finally { setBusy(false); }
  };

  if (step === "pending") {
    return (
      <PartnerShell>
        <h1 className="minimal-auth-title">Application submitted</h1>
        <p className="minimal-auth-subtitle">
          Thanks for your interest in FamOS Ad Partners. We review applications within 1–2 business days.
        </p>
        <Card className="minimal-auth-card !bg-transparent !border-0 !shadow-none">
          <button className="minimal-auth-btn" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </Card>
      </PartnerShell>
    );
  }

  if (step === "profile") {
    return (
      <PartnerShell>
        <h1 className="minimal-auth-title">Tell us about your brand</h1>
        <p className="minimal-auth-subtitle">This helps us match your ads to the right families.</p>
        <Card className="minimal-auth-card !bg-transparent !border-0 !shadow-none">
          <form onSubmit={handleApply}>
            <label className="pfield"><span>Company name *</span>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." required />
            </label>
            <label className="pfield"><span>Website</span>
              <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
            </label>
            <label className="pfield"><span>Industry</span>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
            <label className="pfield"><span>Company size</span>
              <select value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
                <option value="">Select size</option>
                {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="pfield"><span>Monthly ad budget</span>
              <select value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)}>
                <option value="">Select range</option>
                {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            {error && <p className="pform-error">{error}</p>}
            <button className="pbtn pbtn-primary pbtn-full" type="submit" disabled={busy || !companyName.trim()}>
              {busy ? "Please wait…" : "Submit application"}
            </button>
          </form>
          <button type="button" className="pswitch" onClick={() => setStep("auth")}>← Back to sign in</button>
        </Card>
      </PartnerShell>
    );
  }

  return (
    <PartnerShell>
      <h1 className="minimal-auth-title">Create partner account</h1>
      <p className="minimal-auth-subtitle">Join FamOS Ad Partners to reach families who plan their week in one place.</p>
      <Card className="minimal-auth-card !bg-transparent !border-0 !shadow-none">
        <form onSubmit={handleAuth}>
          <label className="pfield"><span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" required />
          </label>
          <label className="pfield"><span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>
          {error && <p className="pform-error">{error}</p>}
          <button className="pbtn pbtn-primary pbtn-full" type="submit" disabled={busy || !email || !password}>
            {busy ? "Please wait…" : "Create partner account"}
          </button>
        </form>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--color-ink-faint)" }}>Already have an account?</span>
          <button className="pbtn pbtn-ghost pbtn-full" type="button" onClick={handleSignIn} disabled={busy || !email || !password}>
            Sign in
          </button>
        </div>
      </Card>
    </PartnerShell>
  );
}

/* ── Partner Profile (application form for existing auth users) ──────── */

function PartnerProfile({ onApplied }) {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleApply = async (e) => {
    e.preventDefault();
    setError("");
    if (!companyName.trim()) { setError("Company name is required"); return; }
    setBusy(true);
    try {
      const result = await partnerApply({ companyName, websiteUrl, contactName: "", industry, companySize, monthlyBudget });
      if (result?.status === "active") {
        onApplied();
      } else {
        setSubmitted(true);
      }
    } catch (err) { setError(err.message || "Application failed"); }
    finally { setBusy(false); }
  };

  if (submitted) {
    return (
      <PartnerShell>
        <h1 className="minimal-auth-title">Application submitted</h1>
        <p className="minimal-auth-subtitle">Thanks for your interest in FamOS Ad Partners. We review applications within 1–2 business days.</p>
        <Card className="minimal-auth-card !bg-transparent !border-0 !shadow-none">
          <button className="pbtn pbtn-ghost pbtn-full" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </Card>
      </PartnerShell>
    );
  }

  return (
    <PartnerShell>
      <h1 className="minimal-auth-title">Tell us about your brand</h1>
      <p className="minimal-auth-subtitle">This helps us match your ads to the right families.</p>
      <Card className="minimal-auth-card !bg-transparent !border-0 !shadow-none">
        <form onSubmit={handleApply}>
          <label className="pfield"><span>Company name *</span>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." required />
          </label>
          <label className="pfield"><span>Website</span>
            <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
          </label>
          <label className="pfield"><span>Industry</span>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="pfield"><span>Company size</span>
            <select value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="pfield"><span>Monthly ad budget</span>
            <select value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)}>
              <option value="">Select range</option>
              {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          {error && <p className="pform-error">{error}</p>}
          <button className="pbtn pbtn-primary pbtn-full" type="submit" disabled={busy || !companyName.trim()}>
            {busy ? "Please wait…" : "Submit application"}
          </button>
        </form>
      </Card>
    </PartnerShell>
  );
}

/* ── Metric Chart (SVG line chart) ────────────────────────────────────── */

function MetricChart({ data, dataKey, color = "var(--partner-accent)", height = 120 }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d[dataKey] || 0);
  const max = Math.max(...values, 1);
  const w = 100;
  const pad = 2;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - v / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="pchart" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id={`pg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${height} ${points} ${w - pad},${height}`}
          fill={`url(#pg-${dataKey})`}
        />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ── Campaign Table Row ───────────────────────────────────────────────── */

function CampaignRow({ campaign, onOpen, onToggle }) {
  const ctr = campaign.ctr_pct ?? (campaign.impressions ? (campaign.clicks / campaign.impressions) * 100 : 0);
  const cpc = campaign.clicks ? campaign.spent_cents / campaign.clicks : 0;
  const budgetPct = campaign.budget_cents ? (campaign.spent_cents / campaign.budget_cents) * 100 : 0;
  const isActive = campaign.status === "active";

  return (
    <tr className="pcampaign-row" onClick={() => onOpen(campaign)}>
      <td className="pcampaign-toggle" onClick={(e) => e.stopPropagation()}>
        <button
          className={`ptoggle ${isActive ? "ptoggle-on" : ""}`}
          onClick={() => onToggle(campaign, isActive ? "paused" : "active")}
          aria-label={isActive ? "Pause campaign" : "Resume campaign"}
        >
          <span className="ptoggle-thumb" />
        </button>
      </td>
      <td className="pcampaign-status"><span className={`pbadge ${STATUS_CLASSES[campaign.status]}`}>{STATUS_LABEL[campaign.status]}</span></td>
      <td className="pcampaign-name">
        <strong>{campaign.name}</strong>
        <span className="pcampaign-headline">{campaign.headline}</span>
      </td>
      <td className="pcampaign-placements">
        {campaign.placements?.map((k) => PLACEMENT_LABELS[k] || k).join(", ") || "All"}
      </td>
      <td className="pcampaign-num">{fmt(campaign.impressions)}</td>
      <td className="pcampaign-num">{fmt(campaign.clicks)}</td>
      <td className="pcampaign-num">{pct(campaign.clicks, campaign.impressions)}%</td>
      <td className="pcampaign-num">{money(cpc)}</td>
      <td className="pcampaign-num">{money(campaign.spent_cents)}</td>
      <td className="pcampaign-budget">
        <div className="pbudget-bar"><div className="pbudget-fill" style={{ width: `${Math.min(budgetPct, 100)}%` }} /></div>
        <span>{money(campaign.budget_cents)}</span>
      </td>
      <td className="pcampaign-actions" onClick={(e) => e.stopPropagation()}>
        <button className="picon-btn" onClick={() => onOpen(campaign)}><ChevronRight size={15} /></button>
      </td>
    </tr>
  );
}

/* ── Campaign Detail ──────────────────────────────────────────────────── */

function CampaignDetail({ campaign, onBack, onEdit, onDelete, onToast, refresh }) {
  const [daily, setDaily] = useState([]);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    if (!campaign?.id) return;
    getCampaignDaily(campaign.id).then(setDaily).catch(() => setDaily([]));
    getCampaignMetrics(campaign.id).then(setMetrics).catch(() => setMetrics([]));
  }, [campaign?.id]);

  const toggleStatus = async () => {
    const next = campaign.status === "active" ? "paused" : "active";
    await toggleCampaign(campaign.id, next);
    onToast(`Campaign ${next === "active" ? "resumed" : "paused"}`);
    refresh();
  };

  const ctr = campaign.ctr_pct ?? (campaign.impressions ? (campaign.clicks / campaign.impressions) * 100 : 0);
  const cpc = campaign.clicks ? campaign.spent_cents / campaign.clicks : 0;
  const cpm = campaign.impressions ? (campaign.spent_cents / campaign.impressions) * 1000 : campaign.cpm_cents || 700;
  const budgetPct = campaign.budget_cents ? (campaign.spent_cents / campaign.budget_cents) * 100 : 0;

  return (
    <div className="pdetail">
      <div className="pdetail-top">
        <button className="pback" onClick={onBack}>← All campaigns</button>
        <div className="pdetail-actions">
          <button className="pbtn pbtn-ghost" onClick={toggleStatus}>
            {campaign.status === "active" ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
          </button>
          <button className="pbtn pbtn-ghost" onClick={() => onEdit(campaign)}><Pencil size={13} /> Edit</button>
          <button className="pbtn pbtn-danger" onClick={() => onDelete(campaign)}><Trash2 size={13} /> Delete</button>
        </div>
      </div>

      <div className="pdetail-hero">
        {campaign.image_url ? <img src={campaign.image_url} alt="" className="pdetail-img" /> : <div className="pdetail-img pdetail-img-placeholder"><Megaphone size={24} /></div>}
        <div className="pdetail-hero-info">
          <div className="pdetail-hero-top">
            <span className={`pbadge ${STATUS_CLASSES[campaign.status]}`}>{STATUS_LABEL[campaign.status]}</span>
            <span className="pdetail-cpm">CPM: {money(cpm)}</span>
          </div>
          <h2>{campaign.name}</h2>
          <p>{campaign.headline}</p>
          {campaign.body_text && <small>{campaign.body_text}</small>}
          <a className="plink" href={campaign.cta_url} target="_blank" rel="noreferrer">{campaign.cta_text} <ExternalLink size={11} /></a>
        </div>
      </div>

      <div className="pkpi-grid">
        <div className="pkpi"><span>Impressions</span><strong>{fmt(campaign.impressions)}</strong></div>
        <div className="pkpi"><span>Clicks</span><strong>{fmt(campaign.clicks)}</strong></div>
        <div className="pkpi"><span>CTR</span><strong>{pct(campaign.clicks, campaign.impressions)}%</strong></div>
        <div className="pkpi"><span>CPC</span><strong>{money(cpc)}</strong></div>
        <div className="pkpi"><span>CPM</span><strong>{money(cpm)}</strong></div>
        <div className="pkpi"><span>Spend</span><strong>{money(campaign.spent_cents)}</strong></div>
        <div className="pkpi"><span>Budget</span><strong>{money(campaign.budget_cents)}</strong></div>
        <div className="pkpi"><span>Budget used</span><strong>{budgetPct.toFixed(1)}%</strong></div>
      </div>

      {daily.length > 1 && (
        <div className="pchart-section">
          <h3>Daily performance</h3>
          <div className="pchart-dual">
            <div className="pchart-panel">
              <span className="pchart-label">Impressions</span>
              <MetricChart data={daily} dataKey="impressions" color="var(--partner-accent)" />
            </div>
            <div className="pchart-panel">
              <span className="pchart-label">Clicks</span>
              <MetricChart data={daily} dataKey="clicks" color="#10b981" />
            </div>
          </div>
        </div>
      )}

      <div className="ptargeting-section">
        <h3>Targeting</h3>
        <div className="ptarget-row"><span><Target size={13} /> Placements</span><div>{campaign.placements?.map((k) => <i key={k}>{PLACEMENT_LABELS[k] || k}</i>)}</div></div>
        {campaign.product_categories?.length > 0 && (
          <div className="ptarget-row"><span><Sparkles size={13} /> Products</span><div>{campaign.product_categories.map((c, i) => <i key={i}>{c}</i>)}</div></div>
        )}
        {(campaign.target_family_min || campaign.target_family_max) && (
          <div className="ptarget-row"><span><Users size={13} /> Family size</span><div><i>{campaign.target_family_min || "Any"}–{campaign.target_family_max || "any"} people</i></div></div>
        )}
        {campaign.target_countries?.length > 0 && (
          <div className="ptarget-row"><span><Globe2 size={13} /> Countries</span><div>{campaign.target_countries.map((c, i) => <i key={i}>{c}</i>)}</div></div>
        )}
        {campaign.target_regions?.length > 0 && (
          <div className="ptarget-row"><span><MapPin size={13} /> Regions</span><div>{campaign.target_regions.map((c, i) => <i key={i}>{c}</i>)}</div></div>
        )}
        {campaign.target_cities?.length > 0 && (
          <div className="ptarget-row"><span><MapPin size={13} /> Cities</span><div>{campaign.target_cities.map((c, i) => <i key={i}>{c}</i>)}</div></div>
        )}
        {campaign.target_postal_codes?.length > 0 && (
          <div className="ptarget-row"><span><MapPin size={13} /> Postal codes</span><div>{campaign.target_postal_codes.map((c, i) => <i key={i}>{c}</i>)}</div></div>
        )}
        {campaign.start_date && (
          <div className="ptarget-row"><span><CalendarDays size={13} /> Schedule</span><div><i>{new Date(campaign.start_date).toLocaleDateString()} — {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : "No end"}</i></div></div>
        )}
      </div>
    </div>
  );
}

/* ── Campaign Editor ──────────────────────────────────────────────────── */

function CampaignEditor({ editing, draft, setDraft, saving, saveError, onSave, onClose, togglePlacement, toggleProduct }) {
  return (
    <div className="peditor">
      <div className="peditor-top">
        <h2>{editing ? "Edit campaign" : "Create campaign"}</h2>
        <button className="pback" onClick={onClose}><X size={15} /> Close</button>
      </div>

      <label className="pfield"><span>Campaign name</span>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Spring produce push" />
      </label>

      <div className="pfield-row">
        <label className="pfield"><span>Headline</span>
          <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="Fresh ideas start here" maxLength={200} />
        </label>
        <label className="pfield"><span>Body text (optional)</span>
          <input value={draft.body_text} onChange={(e) => setDraft({ ...draft, body_text: e.target.value })} placeholder="A warm line to families." />
        </label>
      </div>

      <div className="pfield-row">
        <label className="pfield"><span>CTA text</span>
          <input value={draft.cta_text} onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })} />
        </label>
        <label className="pfield"><span>CTA URL</span>
          <input value={draft.cta_url} onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })} placeholder="https://brand.com/offer" type="url" />
        </label>
      </div>

      <div className="pupload-area">
        <span>Creative image</span>
        {draft.image_url ? (
          <div className="pupload-preview">
            <img src={draft.image_file_preview || draft.image_url} alt="" />
            <button type="button" onClick={() => setDraft({ ...draft, image_url: "", imageFile: null })}><X size={14} /> Remove</button>
          </div>
        ) : (
          <label className="pupload-box">
            <Upload size={18} />
            <span>Upload image (JPEG / PNG / WebP, up to 5MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setDraft({ ...draft, imageFile: file, image_file_preview: URL.createObjectURL(file) });
            }} />
          </label>
        )}
      </div>

      <div className="ptarget-block">
        <h3><Target size={15} /> Placements</h3>
        <p>Where your ad appears for free-plan families.</p>
        <div className="pchips">
          {Object.entries(PLACEMENT_LABELS).map(([key, label]) => {
            const Icon = PLACEMENT_ICONS[key];
            return (
              <button type="button" key={key} className={`pchip ${draft.placements.includes(key) ? "pchip-selected" : ""}`} onClick={() => togglePlacement(key)}>
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ptarget-block">
        <h3><Sparkles size={15} /> Product categories</h3>
        <p>Optional — limiting categories targets households most likely to care.</p>
        <div className="pchips">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button type="button" key={cat} className={`pchip ${draft.product_categories.includes(cat) ? "pchip-selected" : ""}`} onClick={() => toggleProduct(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="ptarget-block">
        <h3><Users size={15} /> Family size (optional)</h3>
        <div className="pfield-row pfield-narrow">
          <label className="pfield"><span>Min people</span>
            <input type="number" min="1" max="30" value={draft.target_family_min} onChange={(e) => setDraft({ ...draft, target_family_min: e.target.value })} placeholder="Any" />
          </label>
          <label className="pfield"><span>Max people</span>
            <input type="number" min="1" max="30" value={draft.target_family_max} onChange={(e) => setDraft({ ...draft, target_family_max: e.target.value })} placeholder="Any" />
          </label>
        </div>
      </div>

      <div className="ptarget-block">
        <h3><Globe2 size={15} /> Location (optional)</h3>
        <div className="pfield-row">
          <label className="pfield"><span>Countries</span>
            <input value={draft.target_countries.join(", ")} onChange={(e) => setDraft({ ...draft, target_countries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Canada, USA" />
          </label>
          <label className="pfield"><span>Regions / provinces</span>
            <input value={draft.target_regions.join(", ")} onChange={(e) => setDraft({ ...draft, target_regions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Ontario, British Columbia" />
          </label>
        </div>
        <div className="pfield-row">
          <label className="pfield"><span>Cities</span>
            <input value={draft.target_cities.join(", ")} onChange={(e) => setDraft({ ...draft, target_cities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Toronto, Vancouver" />
          </label>
          <label className="pfield"><span>Postal codes</span>
            <input value={draft.target_postal_codes.join(", ")} onChange={(e) => setDraft({ ...draft, target_postal_codes: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })} placeholder="M5V, V6B" />
          </label>
        </div>
      </div>

      <div className="ptarget-block">
        <h3><CalendarDays size={15} /> Schedule & budget</h3>
        <div className="pfield-row">
          <label className="pfield"><span>Start date</span>
            <input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
          </label>
          <label className="pfield"><span>End date</span>
            <input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
          </label>
        </div>
        <div className="pfield-row">
          <label className="pfield"><span>Budget (CAD)</span>
            <input type="number" min="0" step="100" value={draft.budget_cents} onChange={(e) => setDraft({ ...draft, budget_cents: e.target.value })} placeholder="500" />
          </label>
          <label className="pfield"><span>CPM rate (cents)</span>
            <input type="number" min="100" step="50" value={draft.cpm_cents} onChange={(e) => setDraft({ ...draft, cpm_cents: e.target.value })} placeholder="700" />
          </label>
        </div>
      </div>

      {saveError && <p className="pform-error">{saveError}</p>}
      <div className="peditor-actions">
        <button className="pbtn pbtn-ghost" onClick={onClose}>Cancel</button>
        <button className="pbtn pbtn-primary" onClick={onSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create campaign"}</button>
      </div>
    </div>
  );
}

/* ── Billing Tab ──────────────────────────────────────────────────────── */

function BillingTab({ billing, invoices, payments }) {
  return (
    <div className="pbilling">
      <div className="pbilling-header">
        <div>
          <h2>Billing & spend</h2>
          <p>Track your ad spend, invoices, and payment history.</p>
        </div>
      </div>

      <div className="pbilling-summary">
        <div className="pbilling-stat"><span>Total impressions</span><strong>{fmt(billing?.total_impressions)}</strong></div>
        <div className="pbilling-stat"><span>Total clicks</span><strong>{fmt(billing?.total_clicks)}</strong></div>
        <div className="pbilling-stat"><span>Total spend</span><strong>{money(billing?.total_spent_cents)}</strong></div>
        <div className="pbilling-stat"><span>Outstanding</span><strong className={billing?.outstanding_cents > 0 ? "pstat-warn" : ""}>{money(billing?.outstanding_cents)}</strong></div>
        <div className="pbilling-stat"><span>Active campaigns</span><strong>{billing?.active_count || 0}</strong></div>
        <div className="pbilling-stat"><span>Avg CPM</span><strong>{money(billing?.avg_cpm_cents)}</strong></div>
      </div>

      <div className="pbilling-section">
        <h3>Recent invoices</h3>
        {invoices.length === 0 ? (
          <p className="pbilling-empty">No invoices yet. Invoices are generated at the end of each billing cycle.</p>
        ) : (
          <div className="pinvoice-table-wrap">
            <table className="pinvoice-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CPM</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{new Date(inv.billing_period_start).toLocaleDateString()} — {new Date(inv.billing_period_end).toLocaleDateString()}</td>
                    <td>{fmt(inv.total_impressions)}</td>
                    <td>{fmt(inv.total_clicks)}</td>
                    <td>{money(inv.cpm_cents)}</td>
                    <td><strong>{money(inv.total_cents)}</strong></td>
                    <td><span className={`pbadge pbadge-${inv.status}`}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pbilling-section">
        <h3>Payment history</h3>
        {payments.length === 0 ? (
          <p className="pbilling-empty">No payments recorded yet.</p>
        ) : (
          <div className="pinvoice-table-wrap">
            <table className="pinvoice-table">
              <thead>
                <tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td>{new Date(pay.created_at).toLocaleDateString()}</td>
                    <td><strong>{money(pay.amount_cents)}</strong></td>
                    <td>{pay.method}</td>
                    <td>{pay.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */

export default function Partner() {
  const [session, setSession] = useState(null);
  const [partner, setPartner] = useState(null);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [billing, setBilling] = useState(null);
  const [analyticsDaily, setAnalyticsDaily] = useState([]);
  const [analyticsPlacement, setAnalyticsPlacement] = useState([]);
  const [analyticsTopCampaigns, setAnalyticsTopCampaigns] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const check = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (!s) { setAllowed(false); setShowProfile(false); setChecking(false); return; }
    const me = await getMyPartner();
    if (me && (me.status === "active" || me.status === "pending")) {
      setPartner(me);
      setAllowed(true);
      setShowProfile(false);
    } else {
      setAllowed(false);
      setShowProfile(true);
    }
    setChecking(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    const list = await getMyCampaigns();
    setCampaigns(list);
    setLoadingCampaigns(false);
  }, []);

  const loadBilling = useCallback(async () => {
    const [inv, pay, sum] = await Promise.all([getMyInvoices(), getMyPayments(), getBillingSummary()]);
    setInvoices(inv);
    setPayments(pay);
    setBilling(sum);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    const [daily, placement, top] = await Promise.all([
      getAnalyticsDaily(),
      getAnalyticsPlacement(),
      getAnalyticsTopCampaigns(),
    ]);
    setAnalyticsDaily(daily);
    setAnalyticsPlacement(placement);
    setAnalyticsTopCampaigns(top);
    setLoadingAnalytics(false);
  }, []);

  useEffect(() => {
    if (allowed) {
      loadCampaigns();
      loadBilling();
      loadAnalytics();
    }
  }, [allowed, loadCampaigns, loadBilling, loadAnalytics]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openCreate = () => { setEditing(null); setDraft({ ...EMPTY_FORM }); setSaveError(""); setTab("editor"); };
  const openEdit = (c) => {
    setEditing(c);
    setDraft({
      ...EMPTY_FORM, name: c.name, headline: c.headline, body_text: c.body_text,
      cta_text: c.cta_text, cta_url: c.cta_url, image_url: c.image_url,
      placements: c.placements || [], product_categories: c.product_categories || [],
      target_family_min: c.target_family_min ?? "", target_family_max: c.target_family_max ?? "",
      target_countries: c.target_countries || [], target_regions: c.target_regions || [],
      target_cities: c.target_cities || [], target_postal_codes: c.target_postal_codes || [],
      start_date: c.start_date ? c.start_date.slice(0, 10) : "",
      end_date: c.end_date ? c.end_date.slice(0, 10) : "",
      budget_cents: c.budget_cents, cpm_cents: c.cpm_cents || 700, status: c.status,
    });
    setSaveError(""); setTab("editor");
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
      if (draft.imageFile) imageUrl = await uploadCreative(draft.imageFile, session.user.id);
      const payload = {
        p_name: draft.name, p_headline: draft.headline, p_body_text: draft.body_text,
        p_cta_text: draft.cta_text, p_cta_url: draft.cta_url, p_image_url: imageUrl,
        p_placements: draft.placements, p_product_categories: draft.product_categories,
        p_target_family_min: draft.target_family_min === "" ? null : Number(draft.target_family_min),
        p_target_family_max: draft.target_family_max === "" ? null : Number(draft.target_family_max),
        p_target_countries: draft.target_countries, p_target_regions: draft.target_regions,
        p_target_cities: draft.target_cities, p_target_postal_codes: draft.target_postal_codes,
        p_start_date: draft.start_date ? `${draft.start_date}T00:00:00Z` : null,
        p_end_date: draft.end_date ? `${draft.end_date}T23:59:59Z` : null,
        p_budget_cents: Number(draft.budget_cents) || 0,
        p_cpm_cents: Number(draft.cpm_cents) || 700,
        p_status: draft.status,
      };
      if (editing) {
        await updateCampaign(editing.id, payload);
        setToast("Campaign updated");
      } else {
        await createCampaign(payload);
        setToast("Campaign created");
      }
      setTab("campaigns");
      loadCampaigns();
    } catch (err) { setSaveError(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleToggle = async (campaign, nextStatus) => {
    await toggleCampaign(campaign.id, nextStatus);
    setToast(`Campaign ${nextStatus === "active" ? "resumed" : "paused"}`);
    loadCampaigns();
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Delete "${campaign.name}"? This can't be undone.`)) return;
    await deleteCampaign(campaign.id);
    setSelected(null);
    setToast("Campaign deleted");
    loadCampaigns();
  };

  const togglePlacement = (key) => setDraft((c) => ({ ...c, placements: c.placements.includes(key) ? c.placements.filter((i) => i !== key) : [...c.placements, key] }));
  const toggleProduct = (cat) => setDraft((c) => ({ ...c, product_categories: c.product_categories.includes(cat) ? c.product_categories.filter((i) => i !== cat) : [...c.product_categories, cat] }));

  const totals = useMemo(() => campaigns.reduce((a, c) => ({
    impressions: a.impressions + (c.impressions || 0),
    clicks: a.clicks + (c.clicks || 0),
    spent: a.spent + (c.spent_cents || 0),
  }), { impressions: 0, clicks: 0, spent: 0 }), [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    if (filterStatus !== "all") list = list.filter((c) => c.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.headline.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, filterStatus, search]);

  if (checking) return <div className="partner-shell"><div className="partner-loading">Loading dashboard…</div></div>;
  if (!session) return <PartnerLogin onSignedIn={check} />;
  if (!allowed) {
    if (showProfile) return <PartnerProfile onApplied={check} />;
    return (
      <div className="partner-shell">
        <div className="partner-denied">
          <div className="partner-denied-icon"><ShieldCheck size={26} /></div>
          {partner?.status === "pending" ? (
            <>
              <h1>Application under review</h1>
              <p>Your application for <strong>{partner.company_name}</strong> is being reviewed. We'll get you access within 1–2 business days.</p>
            </>
          ) : partner?.status === "rejected" ? (
            <>
              <h1>Application not approved</h1>
              <p>Your application for <strong>{partner.company_name}</strong> was not approved at this time. Contact partners@home.fam-os.app for details.</p>
            </>
          ) : (
            <>
              <h1>No partner account</h1>
              <p>This account isn't linked to a FamOS advertising partner. Sign up below to get started.</p>
            </>
          )}
          <button className="pbtn pbtn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  const showDetail = selected && tab === "campaigns";
  const showEditor = tab === "editor";
  const showBilling = tab === "billing";
  const showAnalytics = tab === "analytics";
  const showCampaigns = tab === "campaigns" && !selected && !showEditor;

  return (
    <div className="partner-shell">
      <header className="ptopbar">
        <div className="ptopbar-left">
          <div className="ptopbar-logo"><Megaphone size={18} /></div>
          <div className="ptopbar-brand">
            <strong>FamOS Ad Partners</strong>
            <small>{partner?.company_name}</small>
          </div>
        </div>
        <nav className="ptopbar-tabs">
          <button className={`ptab ${tab === "campaigns" ? "ptab-active" : ""}`} onClick={() => { setTab("campaigns"); setSelected(null); }}>
            <LayoutDashboard size={14} /> Campaigns
          </button>
          <button className={`ptab ${tab === "analytics" ? "ptab-active" : ""}`} onClick={() => setTab("analytics")}>
            <TrendingUp size={14} /> Analytics
          </button>
          <button className={`ptab ${tab === "billing" ? "ptab-active" : ""}`} onClick={() => setTab("billing")}>
            <CreditCard size={14} /> Billing
          </button>
        </nav>
        <div className="ptopbar-right">
          {partner?.status === "active" && <span className="pverified"><CheckCircle2 size={13} /> Verified</span>}
          <button className="psignout" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <div className="playout">
        {showCampaigns && (
          <div className="pcampaigns-view">
            <div className="pcampaigns-header">
              <div className="pcampaigns-stats">
                <div className="pstat"><span>Impressions</span><strong>{fmt(totals.impressions)}</strong></div>
                <div className="pstat"><span>Clicks</span><strong>{fmt(totals.clicks)}</strong></div>
                <div className="pstat"><span>CTR</span><strong>{pct(totals.clicks, totals.impressions)}%</strong></div>
                <div className="pstat"><span>Total spend</span><strong>{money(totals.spent)}</strong></div>
                <div className="pstat"><span>Campaigns</span><strong>{campaigns.length}</strong></div>
              </div>
              <div className="pcampaigns-actions">
                <div className="psearch-wrap">
                  <Search size={14} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns…" />
                </div>
                <select className="pfilter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                  <option value="ended">Ended</option>
                </select>
                <button className="pbtn pbtn-primary" onClick={openCreate}><Plus size={15} /> New campaign</button>
              </div>
            </div>

            {toast && <div className="ptoast">{toast}</div>}

            {loadingCampaigns ? (
              <div className="pcampaigns-loading">Loading…</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="pcampaigns-empty">
                <Megaphone size={32} />
                <strong>{search || filterStatus !== "all" ? "No matching campaigns" : "No campaigns yet"}</strong>
                <p>{search || filterStatus !== "all" ? "Try a different search or filter." : "Create your first ad to start reaching families."}</p>
                {!search && filterStatus === "all" && <button className="pbtn pbtn-primary" onClick={openCreate}><Plus size={15} /> New campaign</button>}
              </div>
            ) : (
              <div className="pcampaigns-table-wrap">
                <table className="pcampaigns-table">
                  <thead>
                    <tr>
                      <th className="pcampaign-toggle" />
                      <th>Status</th>
                      <th>Campaign</th>
                      <th>Placements</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                      <th>CPC</th>
                      <th>Spend</th>
                      <th>Budget</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((c) => (
                      <CampaignRow key={c.id} campaign={c} onOpen={setSelected} onToggle={handleToggle} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {showDetail && (
          <CampaignDetail
            campaign={selected}
            onBack={() => setSelected(null)}
            onEdit={openEdit}
            onDelete={handleDelete}
            onToast={setToast}
            refresh={loadCampaigns}
          />
        )}

        {showEditor && (
          <CampaignEditor
            editing={editing}
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            saveError={saveError}
            onSave={save}
            onClose={() => setTab("campaigns")}
            togglePlacement={togglePlacement}
            toggleProduct={toggleProduct}
          />
        )}

        {showBilling && <BillingTab billing={billing} invoices={invoices} payments={payments} />}
        {showAnalytics && <AnalyticsTab daily={analyticsDaily} placement={analyticsPlacement} topCampaigns={analyticsTopCampaigns} loading={loadingAnalytics} />}
      </div>
    </div>
  );
}

/* ── Analytics Tab ────────────────────────────────────────────────────── */

function AnalyticsTab({ daily, placement, topCampaigns, loading }) {
  const totalImpressions = daily.reduce((sum, d) => sum + (d.impressions || 0), 0);
  const totalClicks = daily.reduce((sum, d) => sum + (d.clicks || 0), 0);
  const totalSpend = daily.reduce((sum, d) => sum + (d.spend_cents || 0), 0);
  const avgCtr = totalImpressions ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  if (loading) return <div className="panalytics-loading">Loading analytics…</div>;
  if (!daily.length) return <div className="panalytics-empty"><BarChart3 size={32} /><strong>No data yet</strong><p>Run some campaigns to see analytics.</p></div>;

  return (
    <div className="panalytics">
      <div className="panalytics-header">
        <div>
          <h2>Analytics</h2>
          <p>Cross-campaign performance insights.</p>
        </div>
      </div>

      <div className="panalytics-summary">
        <div className="panalytic-stat"><span>Total impressions</span><strong>{fmt(totalImpressions)}</strong></div>
        <div className="panalytic-stat"><span>Total clicks</span><strong>{fmt(totalClicks)}</strong></div>
        <div className="panalytic-stat"><span>Avg CTR</span><strong>{avgCtr}%</strong></div>
        <div className="panalytic-stat"><span>Total spend</span><strong>{money(totalSpend)}</strong></div>
      </div>

      <div className="panalytics-charts">
        <div className="panalytic-chart">
          <h3>Performance over time</h3>
          <div className="pchart-dual">
            <div className="pchart-panel">
              <span className="pchart-label">Impressions</span>
              <MetricChart data={daily} dataKey="impressions" color="var(--partner-accent)" />
            </div>
            <div className="pchart-panel">
              <span className="pchart-label">Clicks</span>
              <MetricChart data={daily} dataKey="clicks" color="#10b981" />
            </div>
          </div>
        </div>

        <div className="panalytic-chart">
          <h3>By placement</h3>
          {placement.length ? (
            <table className="ppacement-table">
              <thead><tr><th>Placement</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead>
              <tbody>
                {placement.map((p) => (
                  <tr key={p.placement}>
                    <td><strong>{PLACEMENT_LABELS[p.placement] || p.placement}</strong></td>
                    <td>{fmt(p.impressions)}</td>
                    <td>{fmt(p.clicks)}</td>
                    <td>{p.impressions ? ((p.clicks / p.impressions) * 100).toFixed(2) : "0.00"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pempty">No placement data</p>
          )}
        </div>
      </div>

      <div className="panalytic-chart">
        <h3>Top campaigns</h3>
        {topCampaigns.length ? (
          <table className="ptop-campaigns-table">
            <thead><tr><th>Campaign</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>CPC</th></tr></thead>
            <tbody>
              {topCampaigns.slice(0, 10).map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td><span className={`pbadge ${STATUS_CLASSES[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                  <td>{fmt(c.impressions)}</td>
                  <td>{fmt(c.clicks)}</td>
                  <td>{c.ctr}%</td>
                  <td>{money(c.cpc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="pempty">No campaign data</p>
        )}
      </div>
    </div>
  );
}
