import { useEffect, useMemo, useState } from "react";
import {
  Activity, Archive, ArrowLeft, BadgeDollarSign, Bug, Building2, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, CreditCard, Flag, LayoutDashboard, Lightbulb, ListChecks, LogOut, Mail, MessageCircle,
  Search, Send, Settings2, ShieldCheck, ShoppingCart, Tag, Ticket, Trash2, TrendingUp, UserPlus, Users, Utensils, Gauge, AlertTriangle, Clock3,
  WalletCards, XCircle, RefreshCw, ExternalLink, ReceiptText, Megaphone,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Badge, Card, Modal, PrimaryButton, SecondaryButton, SelectField, TextField } from "../components/ui";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import { passwordError } from "../utils/passwordStrength";
import "../admin.css";

const money = (cents = 0, currency = "CAD") => new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(cents || 0) / 100);
const date = (value) => value ? new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "Never";
const number = (value) => new Intl.NumberFormat("en-CA").format(Number(value || 0));
const totalActivity = (row) => ["task_count", "message_count", "event_count", "grocery_count", "meal_count"].reduce((sum, key) => sum + Number(row[key] || 0), 0);

function AdminLogin({ onSignedIn }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const themeClass = typeof window !== "undefined" && window.localStorage.getItem("familyos:theme") === "dark" ? "theme-dark" : "";
  const colorScheme = typeof window !== "undefined" ? window.localStorage.getItem("familyos:color-scheme") || "famos" : "famos";
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const { data: resolvedEmail, error: resolveError } = await supabase.rpc("admin_login_email", { login_name: login.trim() });
    if (resolveError || !resolvedEmail) { setError("That admin username or email is not recognized."); setBusy(false); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
    if (signInError) setError(signInError.message); else onSignedIn();
    setBusy(false);
  };
  const requestReset = async (event) => {
    event.preventDefault();
    if (!login.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const { data: resolvedEmail } = await supabase.rpc("admin_login_email", { login_name: login.trim() });
      if (resolvedEmail) {
        const { data, error: resetError } = await supabase.functions.invoke("send-password-email", {
          body: { email: resolvedEmail, purpose: "admin_reset", origin: window.location.origin },
        });
        if (resetError || data?.error) throw resetError || new Error(data.error);
      }
      setResetSent(true);
    } catch (resetError) {
      setError(resetError?.message || "The recovery email could not be sent. Try again in a moment.");
    } finally { setBusy(false); }
  };
  return <main className={`admin-login ${themeClass}`} data-color-scheme={colorScheme}><form onSubmit={recovering ? requestReset : submit} className="admin-login-card">
    <img src="/icons/famos-app-icon.png" alt="FamOS" />
    <span className="admin-kicker"><ShieldCheck size={14} /> FamOS operations</span>
    <h1>{recovering ? "Reset admin password" : "Admin sign in"}</h1><p>{recovering ? "We’ll email a secure reset link to the authorized admin account." : "Secure access for authorized FamOS operators."}</p>
    {resetSent ? <div className="admin-recovery-sent"><Mail size={20}/><strong>Check your inbox</strong><span>If that admin account exists, its secure reset link is on the way.</span></div> : <>
    <TextField label="Admin username or email" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
    {!recovering && <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />}
    {error && <div className="admin-error">{error}</div>}
    <PrimaryButton type="submit" disabled={busy || !login || (!recovering && !password)}>{busy ? (recovering ? "Sending…" : "Checking access…") : (recovering ? "Send reset link" : "Open admin dashboard")}</PrimaryButton>
    </>}
    <button type="button" className="admin-recovery-toggle" onClick={() => { setRecovering((current) => !current); setResetSent(false); setError(""); }}>{recovering ? "Back to admin sign in" : "Forgot password?"}</button>
    <button type="button" onClick={() => { window.location.href = "/"; }}>Back to FamOS</button>
  </form></main>;
}

function AdminAccount({ session, onSessionChanged }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(session.user.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState("");
  useEffect(() => { supabase.from("admin_users").select("username").eq("user_id", session.user.id).maybeSingle().then(({ data }) => setUsername(data?.username || "")); }, [session.user.id]);
  const run = async (name, operation, success) => {
    setBusy(name); setNotice({ type: "", text: "" });
    const { error } = await operation;
    if (error) setNotice({ type: "error", text: error.message });
    else { setNotice({ type: "success", text: success }); await onSessionChanged(); }
    setBusy("");
  };
  return <div className="admin-account-grid">
    <Card className="admin-panel bg-finance-soft border-finance"><PanelHead eyebrow="Sign-in identity" title="Admin profile" icon={ShieldCheck} /><p className="admin-section-copy">Use a unique administrator username. This identity stays separate from family accounts.</p><div className="admin-account-form"><TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} /><PrimaryButton disabled={busy || username.length < 3} onClick={() => run("username", supabase.rpc("admin_update_own_username", { next_username: username }), "Admin username updated.")}>Save username</PrimaryButton></div></Card>
    <Card className="admin-panel bg-chat-soft border-chat"><PanelHead eyebrow="Recovery & notices" title="Login email" icon={Mail} /><p className="admin-section-copy">We send a confirmation link to the new address before it becomes active.</p><div className="admin-account-form"><TextField label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><PrimaryButton disabled={busy || !email || email === session.user.email} onClick={() => run("email", supabase.auth.updateUser({ email: email.trim().toLowerCase() }), "Check the new email address to confirm the change.")}>Change email</PrimaryButton></div></Card>
    <Card className="admin-panel bg-famai-soft border-famai"><PanelHead eyebrow="Security" title="Change password" icon={Settings2} /><div className="admin-account-form"><TextField label="New password" type="password" placeholder="8+ characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" /><TextField label="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /><PasswordStrengthMeter value={password} compact /><PrimaryButton disabled={busy || !!passwordError(password) || password !== confirmPassword} onClick={async () => { await run("password", supabase.auth.updateUser({ password }), "Password updated successfully."); setPassword(""); setConfirmPassword(""); }}>Update password</PrimaryButton></div></Card>
    {notice.text && <div className={notice.type === "error" ? "admin-error" : "admin-success"}>{notice.text}</div>}
  </div>;
}

function PanelHead({ eyebrow, title, icon: Icon, action }) {
  return <div className="admin-panel-head"><div><small>{eyebrow}</small><h2>{title}</h2></div>{action || (Icon && <Icon />)}</div>;
}

function Metric({ icon: Icon, label, value, detail, tone = "violet" }) {
  return <Card className={`admin-metric admin-tone-${tone}`}><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></Card>;
}

function TrendChart({ series = [], valueKey = "activity", currency = false, compact = false }) {
  const points = useMemo(() => {
    if (!series.length) return [];
    const target = compact ? 12 : 24;
    const size = Math.max(1, Math.ceil(series.length / target));
    return Array.from({ length: Math.ceil(series.length / size) }, (_, index) => {
      const chunk = series.slice(index * size, (index + 1) * size);
      const value = chunk.reduce((sum, item) => {
        if (valueKey === "activity") return sum + ["tasks", "chats", "events", "groceries", "meals"].reduce((inner, key) => inner + Number(item[key] || 0), 0);
        return sum + Number(item[valueKey] || 0);
      }, 0);
      return { label: chunk[chunk.length - 1]?.label, value };
    });
  }, [series, valueKey, compact]);
  const max = Math.max(...points.map((point) => point.value), 1);
  const coords = points.map((point, index) => `${points.length === 1 ? 50 : index / (points.length - 1) * 100},${92 - point.value / max * 76}`).join(" ");
  return <div className={`admin-trend ${compact ? "compact" : ""}`}>
    <div className="admin-trend-y"><span>{currency ? money(max) : number(max)}</span><span>{currency ? money(max / 2) : number(Math.round(max / 2))}</span><span>0</span></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Trend over time">
      <defs><linearGradient id={`trend-${valueKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7657e8" stopOpacity=".3" /><stop offset="1" stopColor="#7657e8" stopOpacity=".01" /></linearGradient></defs>
      <path d={`M ${coords} L 100,100 L 0,100 Z`} fill={`url(#trend-${valueKey})`} />
      <polyline points={coords} fill="none" stroke="#6b4fe0" strokeWidth="2.1" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="admin-trend-x"><span>{points[0]?.label || "Start"}</span><span>{points[Math.floor(points.length / 2)]?.label || ""}</span><span>{points.at(-1)?.label || "Today"}</span></div>
  </div>;
}

function UsageBars({ overview }) {
  const rows = [["Tasks", overview.tasks30d, ListChecks, "var(--color-tasks)"], ["Chats", overview.messages30d, MessageCircle, "var(--color-chat)"], ["Events", overview.events30d, CalendarDays, "var(--color-calendar)"], ["Groceries", overview.groceries30d, ShoppingCart, "var(--color-shopping)"], ["Meals", overview.meals30d, Utensils, "var(--color-meals)"]];
  const max = Math.max(...rows.map((row) => row[1] || 0), 1);
  return <Card className="admin-panel"><PanelHead eyebrow="Last 30 days" title="Product activity" icon={Activity} /><div className="admin-bars">{rows.map(([label, value, Icon, color]) => <div key={label}><span><Icon size={15} />{label}</span><i><b style={{ width: `${Math.max(3, value / max * 100)}%`, background: color }} /></i><strong>{value || 0}</strong></div>)}</div></Card>;
}

function Adoption({ analytics, households }) {
  const items = [["Tasks", "tasks", "var(--color-tasks)"], ["Chat", "chat", "var(--color-chat)"], ["Calendar", "calendar", "var(--color-calendar)"], ["Groceries", "groceries", "var(--color-shopping)"], ["Meals", "meals", "var(--color-meals)"]];
  const total = Math.max(Number(households || 0), 1);
  return <Card className="admin-panel admin-adoption"><PanelHead eyebrow="Across all families" title="Feature adoption" icon={CheckCircle2} /><div>{items.map(([label, key, color]) => {
    const count = Number(analytics.adoption?.[key] || 0); const percent = Math.round(count / total * 100);
    return <article key={key}><span><i style={{ background: color }} />{label}</span><b><em style={{ width: `${percent}%`, background: color }} /></b><strong>{percent}%</strong></article>;
  })}</div></Card>;
}

function HouseholdTable({ households, onOpen, search, setSearch, title = "Families" }) {
  return <Card className="admin-table-card">
    <div className="admin-table-tools"><div><small>Accounts</small><h2>{title}</h2></div><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search family or owner" /></label></div>
    <div className="admin-table-scroll"><table><thead><tr><th>Family</th><th>Members</th><th>Activity</th><th>Plan</th><th>Status</th><th /></tr></thead><tbody>
      {households.map((row) => <tr key={row.household_id} onClick={() => onOpen(row.household_id)}>
        <td><strong>{row.household_name}</strong><small>{row.owner_email || "No owner email"} · Joined {date(row.created_at)}</small></td>
        <td>{row.member_count}</td><td><span className="admin-activity-total">{totalActivity(row)}</span></td>
        <td><strong>{row.subscription_status === "none" ? "No plan" : money(row.amount_cents)}</strong><small>{row.subscription_status}</small></td>
        <td><span className={`admin-status status-${row.account_status}`}>{row.account_status}</span></td><td><ChevronRight size={17} /></td>
      </tr>)}{!households.length && <tr><td colSpan="6" className="admin-empty">No families match this search.</td></tr>}
    </tbody></table></div>
  </Card>;
}

function UsersTable({ users, search, setSearch, onDelete }) {
  return <Card className="admin-table-card"><div className="admin-table-tools"><div><small>Identity directory</small><h2>All users</h2></div><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, email, or family" /></label></div>
    <div className="admin-table-scroll"><table><thead><tr><th>User</th><th>Family</th><th>Last seen</th><th>Activity</th><th>Access</th><th /></tr></thead><tbody>
      {users.map((user) => <tr key={`${user.user_id}-${user.household_id || "none"}`}>
        <td><strong>{user.display_name || user.email.split("@")[0]}</strong><small>{user.email} · Joined {date(user.created_at)}</small></td>
        <td><strong>{user.household_name || "No family"}</strong><small>{user.member_role || "Unassigned"}</small></td>
        <td>{date(user.last_sign_in_at)}</td><td><span className="admin-activity-total">{totalActivity(user)}</span></td>
        <td><span className={`admin-status ${user.is_admin ? "status-active" : "status-trial"}`}>{user.is_admin ? "admin" : user.member_role || "user"}</span></td>
        <td><button className="admin-icon-danger" disabled={user.is_admin || user.member_role === "owner"} onClick={() => onDelete(user)} title={user.member_role === "owner" ? "Delete the family account to remove its owner" : "Delete user"}><Trash2 size={16} /></button></td>
      </tr>)}{!users.length && <tr><td colSpan="6" className="admin-empty">No users match this search.</td></tr>}
    </tbody></table></div>
  </Card>;
}

function ConfirmDelete({ target, onClose, onConfirm, busy, error }) {
  const required = target?.kind === "household" ? target.name : target?.email;
  const [value, setValue] = useState("");
  return <Modal open={Boolean(target)} onClose={busy ? undefined : onClose} title={`Permanently delete ${target?.kind === "household" ? "family account" : "user"}`}>
    <div className="admin-delete-dialog"><div className="admin-delete-warning"><Trash2 /><p><strong>This cannot be undone.</strong><br />All associated login and family data will be permanently removed.</p></div>
      <p>Type <strong>{required}</strong> to confirm.</p><TextField label="Confirmation" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
      {error && <div className="admin-error">{error}</div>}
      <div><button onClick={onClose} disabled={busy}>Cancel</button><button className="danger" disabled={busy || value !== required} onClick={() => onConfirm(value)}>{busy ? "Deleting…" : "Delete permanently"}</button></div>
    </div>
  </Modal>;
}

function HouseholdDetail({ id, onClose, onChanged, onDelete }) {
  const [detail, setDetail] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const [inviteEmail, setInviteEmail] = useState(""); const [plan, setPlan] = useState({ plan: "family", status: "trial", amount: "699", currency: "CAD", interval: "month" });
  const [payment, setPayment] = useState({ type: "invoice_paid", amount: "", note: "" });
  const [promoCode, setPromoCode] = useState("");
  const load = async () => {
    const { data, error: detailError } = await supabase.rpc("admin_household_detail", { target_household: id });
    if (detailError) setError(detailError.message); else { setDetail(data); if (data?.subscription) setPlan({ plan: data.subscription.plan_key, status: data.subscription.status, amount: String(data.subscription.amount_cents), currency: data.subscription.currency, interval: data.subscription.billing_interval }); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (name, promise) => { setBusy(name); setError(""); const { error: actionError } = await promise; if (actionError) setError(actionError.message); else { await load(); onChanged(); } setBusy(""); };
  if (!detail) return <div className="admin-detail-loading">Loading family…</div>;
  const household = detail.household;
  return <div className="admin-detail"><header><button onClick={onClose}><ArrowLeft size={18} /> Families</button><span className={`admin-status status-${household.status}`}>{household.status}</span></header>
    <div className="admin-detail-title"><div><small>Family account</small><h1>{household.name}</h1><p>{[household.address, household.city, household.country].filter(Boolean).join(", ") || "No household address"}</p></div><Building2 /></div>
    {error && <div className="admin-error">{error}</div>}
    <section className="admin-detail-metrics">{[["Tasks", detail.metrics.tasks], ["Chats", detail.metrics.messages], ["Events", detail.metrics.events], ["Groceries", detail.metrics.groceries], ["Meals", detail.metrics.meals]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</section>
    <section className="admin-detail-section"><PanelHead eyebrow="People" title="Family members" icon={Users} /><div className="admin-member-list">{detail.members.map((member) => <article key={member.id}><span>{(member.display_name || member.email || "?").slice(0, 1).toUpperCase()}</span><div><strong>{member.display_name || "Family member"}</strong><small>{member.email} · {member.role} · Last seen {date(member.last_sign_in_at)}</small><em>{member.assigned_tasks} tasks · {member.messages_sent} chats · {member.events_created} events · {member.groceries_added} groceries · {member.meals_added} meals</em></div>{member.role !== "owner" && <button disabled={busy} onClick={() => act("remove", supabase.rpc("admin_remove_household_member", { target_household: id, target_user: member.id }))}><Trash2 size={15} /></button>}</article>)}</div>
      <div className="admin-inline-form"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Add existing user or create invitation" /><button disabled={!inviteEmail || busy} onClick={async () => { await act("add", supabase.rpc("admin_add_household_member", { target_household: id, target_email: inviteEmail.trim().toLowerCase() })); setInviteEmail(""); }}><UserPlus size={15} /> Add</button></div>
    </section>
    <section className="admin-detail-section"><PanelHead eyebrow="Entitlements" title="Feature flags" icon={Flag} /><div className="admin-flags">{detail.features.map((feature) => <label key={feature.key}><span><strong>{feature.name}</strong><small>{feature.description}</small></span><input type="checkbox" checked={feature.enabled} disabled={busy} onChange={(event) => act(`flag-${feature.key}`, supabase.rpc("admin_set_feature_override", { target_household: id, target_feature: feature.key, next_enabled: event.target.checked }))} /></label>)}</div></section>
    <section className="admin-detail-section"><PanelHead eyebrow="Promotions" title="Unlock access or start a trial" icon={Tag} /><p className="admin-section-copy">Apply an active promotion code to this family. Every change is recorded in the audit log.</p><div className="admin-inline-form"><input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Promotion code" /><button disabled={!promoCode.trim() || busy} onClick={async () => { await act("promo", supabase.rpc("admin_apply_promo_code", { target_household: id, promo_code: promoCode.trim() })); setPromoCode(""); }}><Tag size={15} /> Apply code</button></div></section>
    <section className="admin-detail-section"><PanelHead eyebrow="Commercial" title="Plan & revenue" icon={CircleDollarSign} /><div className="admin-plan-form">
      <label>Plan<input value={plan.plan} onChange={(event) => setPlan({ ...plan, plan: event.target.value })} /></label><label>Status<select value={plan.status} onChange={(event) => setPlan({ ...plan, status: event.target.value })}><option>trial</option><option>active</option><option>past_due</option><option>canceled</option><option>paused</option></select></label>
      <label>Amount in cents<input type="number" value={plan.amount} onChange={(event) => setPlan({ ...plan, amount: event.target.value })} /></label><label>Interval<select value={plan.interval} onChange={(event) => setPlan({ ...plan, interval: event.target.value })}><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
      <button disabled={busy} onClick={() => act("plan", supabase.rpc("admin_upsert_subscription", { target_household: id, next_plan: plan.plan, next_status: plan.status, next_amount_cents: Number(plan.amount), next_currency: plan.currency, next_interval: plan.interval }))}>Save billing</button>
    </div><div className="admin-payment-form"><select value={payment.type} onChange={(event) => setPayment({ ...payment, type: event.target.value })}><option value="invoice_paid">Payment received</option><option value="payment_failed">Payment failed</option><option value="refund">Issue Stripe refund</option><option value="subscription_canceled">Canceled</option></select><input type="number" placeholder="Amount in cents" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /><input placeholder="Internal note" value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} /><button disabled={busy || payment.amount === ""} onClick={async () => { if (payment.type === "refund") await act("payment", supabase.functions.invoke("admin-stripe-refund", { body: { householdId: id, amountCents: Number(payment.amount), note: payment.note } })); else await act("payment", supabase.rpc("admin_record_billing_event", { target_household: id, next_event_type: payment.type, next_amount_cents: Number(payment.amount), next_currency: plan.currency, event_note: payment.note })); setPayment({ type: "invoice_paid", amount: "", note: "" }); }}>{payment.type === "refund" ? "Issue refund" : "Record event"}</button></div></section>
    <section className="admin-danger"><div><strong>Account access</strong><small>Suspend access without deleting family data.</small></div><select value={household.status} disabled={busy} onChange={(event) => act("status", supabase.rpc("admin_set_household_status", { target_household: id, next_status: event.target.value, status_note: "Changed from FamOS admin" }))}><option>active</option><option>trial</option><option>past_due</option><option>suspended</option><option>disabled</option></select></section>
    <section className="admin-danger destructive"><div><strong>Delete family account</strong><small>Permanently removes the family, its users, and all associated data.</small></div><button onClick={() => onDelete({ kind: "household", id, name: household.name })}><Trash2 size={15} /> Delete account</button></section>
  </div>;
}

function AccessPromotions() {
  const empty = { code: "", description: "", type: "trial", trialDays: "30", maxRedemptions: "", endsAt: "" };
  const [form, setForm] = useState(empty); const [promos, setPromos] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = async () => { const { data, error: loadError } = await supabase.rpc("admin_list_promo_codes"); if (loadError) setError(loadError.message); else setPromos(data || []); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (next = form) => { setBusy(true); setError(""); const { error: saveError } = await supabase.rpc("admin_upsert_promo_code", { next_code: next.code.trim().toUpperCase(), next_description: next.description.trim(), next_benefit_type: next.type, next_trial_days: next.type === "trial" ? Number(next.trialDays) : null, next_max_redemptions: next.maxRedemptions ? Number(next.maxRedemptions) : null, next_ends_at: next.endsAt ? new Date(next.endsAt).toISOString() : null, next_is_active: next.isActive ?? true }); if (saveError) setError(saveError.message); else { setForm(empty); await load(); } setBusy(false); };
  return <div className="admin-promotions"><Card className="admin-panel"><PanelHead eyebrow="Growth controls" title="Create a promotion" icon={Tag} /><p className="admin-section-copy">Create controlled offers for support gestures, partnerships, launches, or trials.</p><div className="admin-promo-form"><label>Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="FAMILY30" /></label><label>Benefit<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="trial">All-feature trial</option><option value="unlock_all">Unlock all features</option></select></label>{form.type === "trial" && <label>Trial days<input type="number" min="1" max="365" value={form.trialDays} onChange={(event) => setForm({ ...form, trialDays: event.target.value })} /></label>}<label>Redemption limit<input type="number" min="1" value={form.maxRedemptions} onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })} placeholder="Unlimited" /></label><label>End date<input type="date" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label><label className="admin-promo-description">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Who this offer is for" /></label><button disabled={busy || form.code.length < 3 || (form.type === "trial" && !form.trialDays)} onClick={() => save()}><Tag size={16} /> Save promotion</button></div>{error && <div className="admin-error">{error}</div>}</Card><Card className="admin-table-card"><div className="admin-table-tools"><div><small>Offer library</small><h2>Promotion codes</h2></div></div><div className="admin-table-scroll"><table><thead><tr><th>Code</th><th>Benefit</th><th>Usage</th><th>Ends</th><th>Status</th><th /></tr></thead><tbody>{promos.map((promo) => <tr key={promo.code}><td><strong>{promo.code}</strong><small>{promo.description || "No description"}</small></td><td>{promo.benefit_type === "trial" ? `${promo.trial_days}-day trial` : "All features"}</td><td>{promo.redemption_count}{promo.max_redemptions ? ` / ${promo.max_redemptions}` : ""}</td><td>{promo.ends_at ? date(promo.ends_at) : "No expiry"}</td><td><span className={`admin-status ${promo.is_active ? "status-active" : "status-disabled"}`}>{promo.is_active ? "active" : "inactive"}</span></td><td><button className="admin-promo-toggle" disabled={busy} onClick={() => save({ code: promo.code, description: promo.description, type: promo.benefit_type, trialDays: String(promo.trial_days || 30), maxRedemptions: promo.max_redemptions ? String(promo.max_redemptions) : "", endsAt: promo.ends_at ? promo.ends_at.slice(0, 10) : "", isActive: !promo.is_active })}>{promo.is_active ? "Pause" : "Activate"}</button></td></tr>)}{!promos.length && <tr><td colSpan="6" className="admin-empty">Create the first promotion to offer controlled access.</td></tr>}</tbody></table></div></Card></div>;
}

function SubscriptionPromotions() {
  const initial = { code: "", name: "", discountType: "percentage", discountPercentage: "20", discountAmount: "500", currency: "CAD", durationType: "one_time", period: "1", periodUnit: "month", maxRedemptions: "", validTill: "" };
  const [form, setForm] = useState(initial); const [coupons, setCoupons] = useState([]); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [stripeUrl, setStripeUrl] = useState("");
  const call = async (body) => { const { data, error: requestError } = await supabase.functions.invoke("admin-stripe-promotions", { body }); if (requestError || data?.error) throw requestError || new Error(data.error); return data; };
  const load = async () => { setBusy("load"); setError(""); try { const data = await call({ action: "list" }); setCoupons(data.coupons || []); setStripeUrl(data.stripeUrl || ""); } catch (loadError) { setError(loadError?.message || "Stripe promotions are unavailable."); } setBusy(""); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => { setBusy("create"); setError(""); try { await call({ action: "create", ...form }); setForm(initial); await load(); } catch (createError) { setError(createError?.message || "The subscription promotion could not be created."); setBusy(""); } };
  const archiveCoupon = async (couponId) => { setBusy(couponId); setError(""); try { await call({ action: "archive", couponId }); await load(); } catch (archiveError) { setError(archiveError?.message || "The promotion could not be archived."); setBusy(""); } };
  const value = form.discountType === "percentage" ? `${form.discountPercentage || 0}%` : money(form.discountAmount || 0, form.currency);
  return <><Card className="admin-panel admin-subscription-promos"><PanelHead eyebrow="Stripe subscriptions" title="Create a customer promo code" icon={BadgeDollarSign} action={stripeUrl && <a className="admin-provider-link" href={`${stripeUrl}/coupons`} target="_blank" rel="noreferrer">Open Stripe <ExternalLink size={13}/></a>} /><p className="admin-section-copy">Create a real subscription discount and a single-use customer code. Discounts are enforced by Stripe at checkout.</p>
    <div className="admin-promo-preview"><span><Tag size={18}/></span><div><small>Customer enters</small><strong>{form.code || "WELCOME20"}</strong></div><Badge tone="accent">{value} · {form.durationType.replaceAll("_", " ")}</Badge></div>
    <div className="admin-promo-form">
      <TextField label="Customer code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="WELCOME20" />
      <TextField label="Internal name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Welcome offer" />
      <SelectField label="Discount type" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}><option value="percentage">Percentage</option><option value="fixed_amount">Fixed amount</option></SelectField>
      {form.discountType === "percentage" ? <TextField label="Percent off" type="number" min="0.01" max="100" value={form.discountPercentage} onChange={(event) => setForm({ ...form, discountPercentage: event.target.value })} /> : <TextField label="Amount in cents" type="number" min="1" value={form.discountAmount} onChange={(event) => setForm({ ...form, discountAmount: event.target.value })} />}
      <SelectField label="Duration" value={form.durationType} onChange={(event) => setForm({ ...form, durationType: event.target.value })}><option value="one_time">First invoice</option><option value="limited_period">Limited period</option><option value="forever">Forever</option></SelectField>
      {form.durationType === "limited_period" && <TextField label="Number of periods" type="number" min="1" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} />}
      <TextField label="Redemption limit" type="number" min="1" value={form.maxRedemptions} onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })} placeholder="Unlimited" />
      <TextField label="Valid until" type="date" value={form.validTill} onChange={(event) => setForm({ ...form, validTill: event.target.value })} />
      <PrimaryButton disabled={busy || form.code.length < 3 || form.name.length < 2} onClick={create}><Tag size={16}/>{busy === "create" ? "Creating…" : "Create billing promo"}</PrimaryButton>
    </div>{error && <div className="admin-error">{error}</div>}
  </Card><Card className="admin-table-card"><div className="admin-table-tools"><div><small>Stripe</small><h2>Subscription discounts</h2></div><SecondaryButton onClick={load} disabled={!!busy}><RefreshCw className={busy === "load" ? "spin" : ""} size={15}/>Refresh</SecondaryButton></div><div className="admin-table-scroll"><table><thead><tr><th>Promotion</th><th>Discount</th><th>Duration</th><th>Codes</th><th>Usage</th><th>Status</th><th/></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.name}</strong><small>{coupon.id}</small></td><td>{coupon.discountType === "percentage" ? `${coupon.discountPercentage}%` : money(coupon.discountAmount, coupon.currency || "CAD")}</td><td>{coupon.durationType?.replaceAll("_", " ")}</td><td>{coupon.sets?.flatMap((set) => set.name || []).join(", ") || "Direct coupon"}</td><td>{coupon.redemptions}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}</td><td><Badge tone={coupon.status === "active" ? "success" : "neutral"}>{coupon.status}</Badge></td><td>{coupon.status === "active" && <button className="admin-promo-toggle" disabled={!!busy} onClick={() => archiveCoupon(coupon.id)}>Archive</button>}</td></tr>)}{!coupons.length && <tr><td colSpan="7" className="admin-empty">{busy === "load" ? "Loading Stripe promotions…" : "No subscription promotions yet."}</td></tr>}</tbody></table></div></Card></>;
}

function Promotions() { return <div className="admin-promotions"><SubscriptionPromotions/><div className="admin-local-ledger"><span>FamOS access grants</span><p>Internal unlocks and trials for support or partnership use. These do not create a Stripe charge.</p></div><AccessPromotions/></div>; }

function SaaSOperations({ onOpenHousehold, onOpenSupport }) {
  const [snapshot, setSnapshot] = useState(null); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const load = async () => { setBusy("load"); const { data, error: loadError } = await supabase.rpc("admin_saas_operations_snapshot"); if (loadError) setError(loadError.message); else { setSnapshot(data || {}); setError(""); } setBusy(""); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const resetUsage = async (row) => { setBusy(`${row.household_id}-${row.metric}`); const { error: resetError } = await supabase.rpc("admin_reset_household_api_usage", { target_household: row.household_id, target_metric: row.metric }); if (resetError) setError(resetError.message); else await load(); setBusy(""); };
  if (!snapshot && busy) return <Card className="admin-panel admin-stripe-state"><RefreshCw className="spin"/><strong>Building today’s operations queue…</strong></Card>;
  return <div className="admin-operations">{error && <div className="admin-error">{error}</div>}<section className="admin-metrics-grid">
    <Metric icon={CreditCard} label="Past due" value={snapshot?.pastDue || 0} detail="Billing follow-up" tone="rose"/><Metric icon={Clock3} label="Trials ending" value={snapshot?.trialsEnding7d || 0} detail="Within 7 days" tone="yellow"/><Metric icon={MessageCircle} label="Support SLA" value={snapshot?.overdueSupport || 0} detail="Waiting over 24 hours" tone="fam"/><Metric icon={Gauge} label="Usage risk" value={snapshot?.usageAtRisk || 0} detail="At least 80% consumed" tone="mint"/>
  </section><div className="admin-operations-toolbar"><div><span className="admin-kicker"><ShieldCheck size={13}/>Daily control room</span><p>Work the queues from left to right: revenue risk, customer support, then usage exceptions.</p></div><SecondaryButton onClick={load} disabled={!!busy}><RefreshCw className={busy === "load" ? "spin" : ""} size={15}/>Refresh</SecondaryButton></div>
  <section className="admin-operations-grid"><Card className="admin-table-card"><div className="admin-table-tools"><div><small>Revenue retention</small><h2>Lifecycle attention</h2></div><Badge tone={(snapshot?.lifecycle?.length || 0) ? "warning" : "success"}>{snapshot?.lifecycle?.length || 0} accounts</Badge></div><div className="admin-queue-list">{snapshot?.lifecycle?.map((row) => <button key={row.household_id} onClick={() => onOpenHousehold(row.household_id)}><span className={`admin-queue-icon ${row.status === "past_due" ? "is-risk" : "is-watch"}`}>{row.status === "past_due" ? <AlertTriangle/> : <Clock3/>}</span><div><strong>{row.household_name}</strong><small>{row.status === "past_due" ? "Payment needs attention" : `Trial ends ${date(row.due_at)}`}</small></div><Badge tone={row.status === "past_due" ? "danger" : "warning"}>{row.status.replaceAll("_", " ")}</Badge><ChevronRight/></button>)}{!snapshot?.lifecycle?.length && <p className="admin-empty">No past-due accounts or trials ending this week.</p>}</div></Card>
  <Card className="admin-table-card"><div className="admin-table-tools"><div><small>Response queue</small><h2>Oldest open support</h2></div><Badge tone={(snapshot?.overdueSupport || 0) ? "warning" : "success"}>{snapshot?.overdueSupport || 0} overdue</Badge></div><div className="admin-queue-list">{snapshot?.support?.slice(0,8).map((row) => <button key={row.id} onClick={() => onOpenSupport(row.id)}><span className={`admin-queue-icon ${row.age_hours >= 24 ? "is-risk" : ""}`}><MessageCircle/></span><div><strong>{row.subject}</strong><small>{row.household_name || row.sender_email || "Anonymous"} · {row.age_hours}h waiting</small></div><Badge tone={row.age_hours >= 24 ? "danger" : "neutral"}>{row.priority}</Badge><ChevronRight/></button>)}{!snapshot?.support?.length && <p className="admin-empty">The support queue is clear.</p>}</div></Card></section>
  <Card className="admin-table-card"><div className="admin-table-tools"><div><small>Cost guardrail</small><h2>Monthly API usage</h2></div><span>Resets automatically each month</span></div><div className="admin-table-scroll"><table><thead><tr><th>Family</th><th>Meter</th><th>Consumption</th><th>Used</th><th>Updated</th><th/></tr></thead><tbody>{snapshot?.usage?.map((row) => <tr key={`${row.household_id}-${row.metric}`}><td><strong>{row.household_name}</strong></td><td>{row.metric === "famai_queries" ? "FamAI queries" : "Premium API operations"}</td><td><div className="admin-usage-meter"><i><b style={{ width: `${Math.min(100,row.percent_used)}%` }}/></i><span>{row.percent_used}%</span></div></td><td>{row.used_count} / {row.allowance}</td><td>{date(row.updated_at)}</td><td><button className="admin-provider-link" disabled={!!busy || !row.used_count} onClick={() => resetUsage(row)}>{busy === `${row.household_id}-${row.metric}` ? "Resetting…" : "Reset allowance"}</button></td></tr>)}{!snapshot?.usage?.length && <tr><td colSpan="6" className="admin-empty">No metered usage recorded this month.</td></tr>}</tbody></table></div></Card></div>;
}

function TopFamilies({ families = [], onOpen }) {
  const max = Math.max(...families.map((item) => Number(item.activity_count || 0)), 1);
  return <Card className="admin-panel admin-top-families"><PanelHead eyebrow="Engagement" title="Top families" icon={TrendingUp} /><div>{families.map((family, index) => <button key={family.id} onClick={() => onOpen(family.id)}><span>{index + 1}</span><div><strong>{family.name}</strong><small>{family.plan} · {money(family.mrr_cents)} MRR</small><i><em style={{ width: `${Number(family.activity_count || 0) / max * 100}%` }} /></i></div><b>{number(family.activity_count)}</b></button>)}{!families.length && <p className="admin-empty">Activity will appear as families use FamOS.</p>}</div></Card>;
}

function StripeRevenue({ range }) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setBusy(true); setError("");
    const { data, error: requestError } = await supabase.functions.invoke("admin-stripe-analytics", { body: { days: range } });
    if (requestError || data?.error) setError(data?.error || requestError?.message || "Stripe reporting is unavailable.");
    else setReport(data);
    setBusy(false);
  };
  useEffect(() => { load(); }, [range]); // eslint-disable-line react-hooks/exhaustive-deps
  const openCustomer = async (customerId) => {
    setError("");
    const { data, error: portalError } = await supabase.functions.invoke("admin-stripe-portal", { body: { customerId } });
    if (portalError || data?.error || !data?.url) setError(data?.error || portalError?.message || "Could not open customer billing.");
    else window.open(data.url, "_blank", "noopener,noreferrer");
  };
  if (!report && busy) return <Card className="admin-panel admin-stripe-state"><RefreshCw className="spin" /><strong>Loading live Stripe data…</strong></Card>;
  return <section className="admin-stripe-live">
    <Card className="admin-panel admin-stripe-head"><div><span className="admin-kicker"><CreditCard size={13}/> Live provider data</span><h2>Stripe billing intelligence</h2><p>{report ? `Updated ${new Date(report.generatedAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}` : "Connect the reporting function to load provider data."}</p></div><div><button onClick={load} disabled={busy}><RefreshCw className={busy ? "spin" : ""} size={15}/>{busy ? "Refreshing…" : "Refresh"}</button>{report?.stripeUrl && <a href={`${report.stripeUrl}/dashboard`} target="_blank" rel="noreferrer">Stripe dashboard <ExternalLink size={14}/></a>}</div></Card>
    {error && <div className="admin-error">{error}</div>}
    {report && <>
      <div className="admin-metrics-grid admin-provider-metrics"><Metric icon={CircleDollarSign} label="Live MRR" value={money(report.metrics.mrrCents, report.currency)} detail={`${money(report.metrics.arrCents, report.currency)} ARR`} /><Metric icon={WalletCards} label="Net collected" value={money(report.metrics.netCollectedCents, report.currency)} detail={`${money(report.metrics.refundedCents, report.currency)} refunded · ${range}d`} tone="mint"/><Metric icon={CreditCard} label="Subscriptions" value={report.metrics.active} detail={`${report.metrics.trials} trials · ${report.metrics.nonRenewing} ending`} tone="yellow"/><Metric icon={ReceiptText} label="Outstanding" value={money(report.metrics.outstandingCents, report.currency)} detail={`${report.metrics.failedInvoices} invoices need attention`} tone="rose"/></div>
      <div className="admin-provider-grid"><Card className="admin-table-card"><div className="admin-table-tools"><div><small>Live subscriptions</small><h2>Subscription management</h2></div><span>{report.subscriptions.length} loaded</span></div><div className="admin-table-scroll"><table><thead><tr><th>Customer</th><th>Plan items</th><th>Status</th><th>MRR</th><th>Renews / ends</th><th/></tr></thead><tbody>{report.subscriptions.map((sub) => <tr key={sub.id}><td><strong>{sub.customerId}</strong><small>{sub.id}</small></td><td><strong>{sub.items[0] || "No plan item"}</strong><small>{sub.items.slice(1).join(", ")}</small></td><td><span className={`admin-status status-${sub.status === "in_trial" ? "trial" : sub.status}`}>{sub.status.replaceAll("_", " ")}</span></td><td>{money(sub.mrrCents, sub.currency)}</td><td>{date(sub.renewsAt || sub.trialEndsAt)}</td><td><button className="admin-provider-link" onClick={() => openCustomer(sub.customerId)}>Manage <ExternalLink size={13}/></button></td></tr>)}{!report.subscriptions.length && <tr><td colSpan="6" className="admin-empty">No Stripe subscriptions yet.</td></tr>}</tbody></table></div></Card>
      <Card className="admin-table-card"><div className="admin-table-tools"><div><small>Last {range} days</small><h2>Invoices</h2></div><span>{report.metrics.paidInvoices} paid</span></div><div className="admin-table-scroll"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Status</th><th>Total</th><th>Outstanding</th><th>Date</th></tr></thead><tbody>{report.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.id}</strong><small>{invoice.subscriptionId || "One-time invoice"}</small></td><td>{invoice.customerId}</td><td><span className={`admin-status status-${invoice.status === "paid" ? "active" : "past_due"}`}>{invoice.status.replaceAll("_", " ")}</span></td><td>{money(invoice.totalCents, invoice.currency)}</td><td>{money(invoice.dueCents, invoice.currency)}</td><td>{date(invoice.date)}</td></tr>)}{!report.invoices.length && <tr><td colSpan="6" className="admin-empty">No invoices in this reporting period.</td></tr>}</tbody></table></div></Card></div>
    </>}
  </section>;
}

function SupportMessagesTable({ messages, onOpen, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, archiveFilter, setArchiveFilter, search, setSearch }) {
  return <Card className="admin-table-card">
    <div className="admin-table-tools">
      <div><small>Inbox</small><h2>Support messages</h2></div>
      <div className="admin-support-filters">
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          <option value="email">Email</option>
          <option value="bug">Bug reports</option>
          <option value="ticket">Support tickets</option>
          <option value="feature">Feature ideas</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
        </select>
        <select value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value)} aria-label="Archive view">
          <option value="active">Active inbox</option><option value="archived">Archived</option><option value="all">All messages</option>
        </select>
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages…" /></label>
      </div>
    </div>
    <div className="admin-table-scroll"><table><thead><tr><th>Subject</th><th>Category</th><th>From</th><th>Household</th><th>Priority</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
      {messages.map((message) => <tr key={message.id} onClick={() => onOpen(message.id)}>
        <td><strong>{message.subject}</strong></td>
        <td><span className={`admin-support-cat admin-cat-${message.category}`}>{message.category === "feature" ? "Feature" : message.category === "bug" ? "Bug" : message.category === "ticket" ? "Ticket" : "Email"}</span></td>
        <td><small>{message.sender_email || (message.user_id ? "Signed in" : "Anonymous")}</small></td>
        <td><small>{message.household_name || "—"}</small></td>
        <td>{message.priority !== "normal" ? <span className={`admin-priority p-${message.priority}`}>{message.priority}</span> : <small className="text-[var(--color-ink-faint)]">Normal</small>}</td>
        <td><span className={`admin-support-status ss-${message.status}`}>{message.status}</span></td>
        <td><small>{date(message.created_at)}</small></td>
        <td><ChevronRight size={17} /></td>
      </tr>)}{!messages.length && <tr><td colSpan="8" className="admin-empty">No support messages match these filters.</td></tr>}
    </tbody></table></div>
  </Card>;
}

function SupportMessageDetail({ id, onClose, onChanged, onDeleted }) {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const load = async () => {
    const { data, error: detailError } = await supabase.rpc("admin_get_support_message", { target_id: id });
    if (detailError) setError(detailError.message); else setMessage(data);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const updateStatus = async (nextStatus) => {
    setBusy("status"); setError("");
    const { error: actionError } = await supabase.rpc("admin_update_support_message_status", { target_id: id, next_status: nextStatus });
    if (actionError) setError(actionError.message); else { await load(); onChanged(); }
    setBusy("");
  };
  const archiveMessage = async (nextArchived) => { setBusy("archive"); setError(""); const { error: actionError } = await supabase.rpc("admin_archive_support_message", { target_id: id, next_archived: nextArchived }); if (actionError) setError(actionError.message); else { await load(); onChanged(); } setBusy(""); };
  const deleteMessage = async () => { setBusy("delete"); setError(""); const { error: actionError } = await supabase.rpc("admin_delete_support_message", { target_id: id }); if (actionError) { setError(actionError.message); setBusy(""); } else onDeleted(); };
  if (!message) return <div className="admin-detail-loading">Loading message…</div>;
  const categoryIcon = message.category === "feature" ? Lightbulb : message.category === "bug" ? Bug : message.category === "ticket" ? Ticket : Mail;
  return <div className="admin-detail"><header>
    <button onClick={onClose}><ArrowLeft size={18} /> Support messages</button>
    <div className="admin-support-detail-status">
      <span className={`admin-support-status ss-${message.status}`}>{message.status}</span>
      {message.status !== "read" && <button disabled={!!busy} onClick={() => updateStatus("read")}><CheckCircle2 size={14} /> {busy === "status" ? "…" : "Mark read"}</button>}
      {message.status !== "replied" && <button disabled={!!busy} onClick={() => updateStatus("replied")}><Send size={14} /> {busy === "status" ? "…" : "Mark replied"}</button>}
      {message.status !== "closed" && <button disabled={!!busy} onClick={() => updateStatus("closed")}><Archive size={14} /> {busy === "status" ? "…" : "Close"}</button>}
      <button disabled={!!busy} onClick={() => archiveMessage(!message.archived_at)}>{message.archived_at ? <RefreshCw size={14}/> : <Archive size={14}/>} {busy === "archive" ? "…" : message.archived_at ? "Restore" : "Archive"}</button>
      <button className="admin-support-delete" disabled={!!busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14}/>Delete</button>
    </div>
  </header>
    {error && <div className="admin-error">{error}</div>}
    <Card className="admin-panel admin-support-detail-card">
      <div className="admin-support-detail-head">
        <span className="admin-support-detail-icon">{categoryIcon ? (() => { const CategoryIcon = categoryIcon; return <CategoryIcon size={22} />; })() : <Mail size={22} />}</span>
        <div>
          <div className="admin-support-detail-meta">
            <span className={`admin-support-cat admin-cat-${message.category}`}>{message.category === "feature" ? "Feature idea" : message.category === "bug" ? "Bug report" : message.category === "ticket" ? "Support ticket" : "Email"}</span>
            {message.priority !== "normal" && <span className={`admin-priority p-${message.priority}`}>{message.priority} priority</span>}
          </div>
          <h1 style={{ fontSize: "clamp(1.3rem,2vw,1.8rem)", margin: "6px 0", font: "700 clamp(1.3rem,2vw,1.8rem)/1.2 var(--font-display)" }}>{message.subject}</h1>
        </div>
      </div>
      <div className="admin-support-detail-info">
        <div><small>From</small><span>{message.sender_email || "Not provided"}</span></div>
        <div><small>Household</small><span>{message.household_name || "—"}</span></div>
        <div><small>Date</small><span>{new Date(message.created_at).toLocaleString("en-CA", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
        <div><small>App version</small><span>{message.app_version || "1.0"}</span></div>
      </div>
      <div className="admin-support-detail-body">
        <p>{message.message}</p>
      </div>
      {message.steps && (
        <div className="admin-support-detail-steps">
          <small>Steps to reproduce</small>
          <p>{message.steps}</p>
        </div>
      )}
    </Card>
    <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Permanently delete ticket"><div className="admin-delete-dialog"><div className="admin-delete-warning"><Trash2/><p><strong>This cannot be undone.</strong><br/>Archive the ticket instead if you may need its history later.</p></div><p>Delete <strong>{message.subject}</strong> permanently?</p><div><button onClick={() => setConfirmDelete(false)} disabled={!!busy}>Cancel</button><button className="danger" onClick={deleteMessage} disabled={!!busy}>{busy === "delete" ? "Deleting…" : "Delete ticket"}</button></div></div></Modal>
  </div>;
}

function EmailAnalytics() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [statsResult, eventsResult] = await Promise.all([
        supabase.from("onboarding_email_stats").select("*"),
        supabase.from("onboarding_email_events")
          .select("*, onboarding_emails(email_type)")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setStats(statsResult.data || []);
      setRecentEvents(eventsResult.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const emailTypeLabels = {
    welcome: "Welcome",
    day1_quick_wins: "Day 1 — Quick Wins",
    day3_tips: "Day 3 — Tips",
    day7_recap: "Day 7 — Recap",
    day14_missing: "Day 14 — What You're Missing",
    day21_nudge: "Day 21 — Trial Nudge",
    day28_final: "Day 28 — Final Notice",
  };

  if (loading) return <Card className="admin-panel"><PanelHead eyebrow="Email marketing" title="Email analytics" icon={Mail} /><p className="admin-empty">Loading email analytics…</p></Card>;

  return (
    <>
      <section className="admin-metrics-grid">
        {stats.map((row) => (
          <Metric
            key={row.email_type}
            icon={Mail}
            label={emailTypeLabels[row.email_type] || row.email_type}
            value={`${row.open_rate_pct || 0}%`}
            detail={`${row.total_sent} sent · ${row.unique_clicks} clicked`}
            tone="fam"
          />
        ))}
        {!stats.length && <Card className="admin-panel"><PanelHead eyebrow="Email marketing" title="Email analytics" icon={Mail} /><p className="admin-empty">No lifecycle emails sent yet. Analytics will appear after the first onboarding completes.</p></Card>}
      </section>
      <Card className="admin-table-card">
        <div className="admin-table-tools">
          <div><small>Email marketing</small><h2>Recent email events</h2></div>
        </div>
        <table>
          <thead><tr><th>Email type</th><th>Event</th><th>Link</th><th>Timestamp</th></tr></thead>
          <tbody>
            {recentEvents.map((event) => (
              <tr key={event.id}>
                <td><strong>{emailTypeLabels[event.email_type] || event.email_type}</strong></td>
                <td><span className={`admin-support-status ss-${event.event_type === "open" ? "read" : "replied"}`}>{event.event_type}</span></td>
                <td>{event.link_url ? <small style={{wordBreak:"break-all"}}>{event.link_url}</small> : <small style={{color:"var(--text-muted)"}}>—</small>}</td>
                <td><time>{new Date(event.created_at).toLocaleString()}</time></td>
              </tr>
            ))}
            {!recentEvents.length && <tr><td colSpan={4} className="admin-empty">No events recorded yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function ProductUpdates() {
  const [updates, setUpdates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", summary: "", body: "", category: "update", icon: "sparkles", linkUrl: "", linkLabel: "" });
  const [sending, setSending] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("product_updates").select("*").order("created_at", { ascending: false });
    setUpdates(data || []);
  };
  useEffect(() => { load(); }, []);

  const createAndSend = async () => {
    if (!form.title.trim() || !form.summary.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const { data: inserted, error: insertError } = await supabase.from("product_updates").insert({
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        category: form.category,
        icon: form.icon,
        link_url: form.linkUrl.trim() || null,
        link_label: form.linkLabel.trim() || null,
        is_active: true,
        published_at: new Date().toISOString(),
      }).select().single();
      if (insertError) throw insertError;

      // Send emails
      const { data: sendResult, error: sendError } = await supabase.functions.invoke("send-product-update", { body: { updateId: inserted.id } });
      if (sendError) throw sendError;

      setForm({ title: "", summary: "", body: "", category: "update", icon: "sparkles", linkUrl: "", linkLabel: "" });
      await load();
      setSending({ sent: sendResult?.sent || 0, total: sendResult?.total || 0 });
      setTimeout(() => setSending(null), 5000);
    } catch (e) {
      setError(e?.message || "Failed to send update");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id, isActive) => {
    await supabase.from("product_updates").update({ is_active: isActive }).eq("id", id);
    await load();
  };

  return (
    <div className="admin-promotions">
      <Card className="admin-panel">
        <PanelHead eyebrow="User communication" title="Send product update" icon={Megaphone} />
        <p className="admin-section-copy">Compose an update and send it as an email to all FamOS users. It will also appear as an in-app banner on the Today page.</p>
        <div className="admin-promo-form">
          <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What's new in FamOS" /></label>
          <label>Summary<textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="A short description of the update" rows={2} /></label>
          <label>Details (optional)<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Additional details or changelog" rows={3} /></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="update">Product update</option><option value="feature">New feature</option><option value="fix">Bug fix</option></select></label>
          <label>Link URL (optional)<input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." /></label>
          <label>Link label (optional)<input value={form.linkLabel} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} placeholder="Learn more" /></label>
          <button disabled={busy || !form.title.trim() || !form.summary.trim()} onClick={createAndSend}><Megaphone size={16} /> {busy ? "Sending…" : "Send to all users"}</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        {sending && <div className="admin-success">Update sent to {sending.sent} of {sending.total} users. It will appear on the Today page.</div>}
      </Card>
      <Card className="admin-table-card">
        <div className="admin-table-tools"><div><small>History</small><h2>Product updates</h2></div></div>
        <div className="admin-table-scroll">
          <table><thead><tr><th>Title</th><th>Category</th><th>Sent</th><th>Status</th><th /></tr></thead>
            <tbody>{updates.map((u) => (
              <tr key={u.id}><td><strong>{u.title}</strong><small>{u.summary?.slice(0, 80)}</small></td>
                <td>{u.category === "feature" ? "Feature" : u.category === "fix" ? "Fix" : "Update"}</td>
                <td>{u.published_at ? date(u.published_at) : "Draft"}</td>
                <td><span className={`admin-status ${u.is_active ? "status-active" : "status-disabled"}`}>{u.is_active ? "active" : "hidden"}</span></td>
                <td><button className="admin-promo-toggle" disabled={busy} onClick={() => toggleActive(u.id, !u.is_active)}>{u.is_active ? "Hide" : "Show"}</button></td>
              </tr>
            ))}{!updates.length && <tr><td colSpan="5" className="admin-empty">No product updates yet.</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function Admin() {
  const [checking, setChecking] = useState(true); const [session, setSession] = useState(null); const [allowed, setAllowed] = useState(false);
  const [section, setSection] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("recovery") === "1" ? "account" : "overview"); const [overview, setOverview] = useState({}); const [analytics, setAnalytics] = useState({});
  const [households, setHouseholds] = useState([]); const [users, setUsers] = useState([]); const [audit, setAudit] = useState([]);
  const [search, setSearch] = useState(""); const [userSearch, setUserSearch] = useState(""); const [selected, setSelected] = useState(null);
  const [range, setRange] = useState(90); const [error, setError] = useState(""); const [deleteTarget, setDeleteTarget] = useState(null); const [deleteBusy, setDeleteBusy] = useState(false); const [deleteError, setDeleteError] = useState("");
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportCategoryFilter, setSupportCategoryFilter] = useState("");
  const [supportStatusFilter, setSupportStatusFilter] = useState("");
  const [supportArchiveFilter, setSupportArchiveFilter] = useState("active");
  const [supportSelected, setSupportSelected] = useState(null);
  const [supportRefreshKey, setSupportRefreshKey] = useState(0);
  const [supportCounts, setSupportCounts] = useState({});
  const [latestSupportMessages, setLatestSupportMessages] = useState([]);
  const themeClass = typeof window !== "undefined" && window.localStorage.getItem("familyos:theme") === "dark" ? "theme-dark" : "";
  const colorScheme = typeof window !== "undefined" ? window.localStorage.getItem("familyos:color-scheme") || "famos" : "famos";
  const check = async () => {
    const { data: { session: activeSession } } = await supabase.auth.getSession(); setSession(activeSession);
    if (!activeSession) { setAllowed(false); setChecking(false); return; }
    const { data, error: accessError } = await supabase.rpc("is_famos_admin"); setAllowed(Boolean(data));
    if (accessError || !data) setError(accessError?.message || "This account is not authorized for FamOS administration."); setChecking(false);
  };
  const load = async () => {
    const [summaryResult, familyResult, userResult, analyticsResult, auditResult] = await Promise.all([
      supabase.rpc("admin_dashboard_overview"), supabase.rpc("admin_list_households", { search_text: search, page_limit: 200, page_offset: 0 }),
      supabase.rpc("admin_list_users", { search_text: userSearch, page_limit: 300, page_offset: 0 }), supabase.rpc("admin_analytics_snapshot", { range_days: range }),
      supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const firstError = summaryResult.error || familyResult.error || userResult.error || analyticsResult.error || auditResult.error;
    if (firstError) setError(firstError.message); else setError("");
    setOverview(summaryResult.data || {}); setHouseholds(familyResult.data || []); setUsers(userResult.data || []); setAnalytics(analyticsResult.data || {}); setAudit(auditResult.data || []);
  };
  useEffect(() => { check(); }, []);
  useEffect(() => { if (allowed) load(); }, [allowed, search, userSearch, range]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!allowed) return;
    supabase.rpc("admin_support_message_counts").then(({ data }) => {
      if (data) setSupportCounts(data);
    });
    supabase.rpc("admin_list_support_messages_v2", { category_filter: "", status_filter: "", search_text: "", archive_filter: "active", page_limit: 5, page_offset: 0 }).then(({ data }) => {
      if (data) setLatestSupportMessages(data);
    });
  }, [allowed, supportRefreshKey]);
  useEffect(() => {
    if (!allowed || section !== "support") return;
    const loadSupport = async () => {
      const { data, error: supportError } = await supabase.rpc("admin_list_support_messages_v2", {
        category_filter: supportCategoryFilter, status_filter: supportStatusFilter, search_text: supportSearch, archive_filter: supportArchiveFilter, page_limit: 200, page_offset: 0,
      });
      if (supportError) setError(supportError.message);
      else setSupportMessages(data || []);
    };
    loadSupport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, section, supportCategoryFilter, supportStatusFilter, supportArchiveFilter, supportSearch, supportRefreshKey]);
  const confirmDelete = async (confirmation) => {
    setDeleteBusy(true); setDeleteError("");
    const promise = deleteTarget.kind === "household"
      ? supabase.rpc("admin_delete_household", { target_household: deleteTarget.id, confirmation })
      : supabase.rpc("admin_delete_user", { target_user: deleteTarget.id, confirmation });
    const { error: actionError } = await promise;
    if (actionError) setDeleteError(actionError.message);
    else { setDeleteTarget(null); setSelected(null); await load(); }
    setDeleteBusy(false);
  };
  if (checking) return <main className={`admin-loading ${themeClass}`} data-color-scheme={colorScheme}>Checking admin access…</main>;
  if (!session) return <AdminLogin onSignedIn={check} />;
  if (!allowed) return <main className={`admin-denied ${themeClass}`} data-color-scheme={colorScheme}><XCircle /><h1>Admin access required</h1><p>{error}</p><button onClick={async () => { await supabase.auth.signOut(); setSession(null); }}>Use another account</button></main>;
  if (supportSelected) return <main className={`admin-shell admin-detail-shell ${themeClass}`} data-color-scheme={colorScheme}><SupportMessageDetail id={supportSelected} onClose={() => setSupportSelected(null)} onChanged={() => setSupportRefreshKey((prev) => prev + 1)} onDeleted={() => { setSupportSelected(null); setSupportRefreshKey((prev) => prev + 1); }} /></main>;
  if (selected) return <main className={`admin-shell admin-detail-shell ${themeClass}`} data-color-scheme={colorScheme}><HouseholdDetail id={selected} onClose={() => setSelected(null)} onChanged={load} onDelete={setDeleteTarget} /><ConfirmDelete target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} busy={deleteBusy} error={deleteError} /></main>;
  const nav = [["overview", "Overview", LayoutDashboard], ["operations", "Operations", Gauge], ["families", "Families", Building2], ["users", "Users", Users], ["revenue", "Revenue", BadgeDollarSign], ["promotions", "Promotions", Tag], ["updates", "Product updates", Megaphone], ["emails", "Email analytics", Mail], ["support", "Support", MessageCircle, supportCounts.new], ["flags", "Feature flags", Flag], ["audit", "Audit log", ShieldCheck], ["account", "Admin account", Settings2]];
  const activePercent = overview.households ? Math.round(Number(analytics.activeHouseholds30d || 0) / Number(overview.households) * 100) : 0;
  return <div className={`admin-shell ${themeClass}`} data-color-scheme={colorScheme}>    <aside><div className="admin-brand"><span className="admin-brand-icon"><img src="/brand/famos-icon.png" alt="FamOS" /></span><strong>Fam<span>OS</span></strong><small>Admin</small></div><nav>{nav.map(([key, label, Icon, badge]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={18} />{badge ? <span className="admin-dot" /> : null}{label}{badge ? <span className="admin-badge">{badge}</span> : null}</button>)}</nav><button className="admin-signout" onClick={async () => { await supabase.auth.signOut(); setSession(null); }}><LogOut size={17} /> Sign out</button></aside>
    <main><header className="admin-topbar"><div><span className="admin-kicker"><ShieldCheck size={13} /> Operations center</span><h1>{nav.find(([key]) => key === section)?.[1]}</h1></div><div className="admin-topbar-actions">{["overview", "revenue"].includes(section) && <select aria-label="Statistics period" value={range} onChange={(event) => setRange(Number(event.target.value))}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option><option value="730">24 months</option></select>}<div className="admin-operator"><span>{session.user.email?.[0]?.toUpperCase()}</span><small>{session.user.email}</small></div></div></header>
      {error && <div className="admin-error">{error}</div>}
      {section === "overview" && <><section className="admin-metrics-grid">
        <Metric icon={Building2} label="Total families" value={number(overview.households)} detail={`${analytics.activeHouseholds30d || 0} active in 30d`} />
        <Metric icon={Users} label="Total users" value={number(overview.users)} detail={`${overview.activeUsers30d || 0} signed in recently`} tone="mint" />
        <Metric icon={CircleDollarSign} label="MRR" value={money(overview.mrrCents, overview.currency)} detail={`${money(overview.arrCents, overview.currency)} ARR`} tone="yellow" />
        <Metric icon={Activity} label="Engagement" value={`${activePercent}%`} detail={`${analytics.activeHouseholds7d || 0} active families this week`} tone="rose" />
        <Metric icon={MessageCircle} label="Support tickets" value={number(Number(supportCounts.new || 0) + Number(supportCounts.read || 0))} detail={`${supportCounts.new || 0} new · ${supportCounts.replied || 0} replied`} tone="fam" />
      </section>
      <section className="admin-analytics-grid"><Card className="admin-panel admin-main-chart"><PanelHead eyebrow={`${range}-day intelligence`} title="Product engagement" icon={TrendingUp} /><div className="admin-chart-summary"><strong>{number((analytics.series || []).reduce((sum, item) => sum + ["tasks", "chats", "events", "groceries", "meals"].reduce((inner, key) => inner + Number(item[key] || 0), 0), 0))}</strong><span>actions across FamOS</span></div><TrendChart series={analytics.series} /></Card><TopFamilies families={analytics.topFamilies} onOpen={setSelected} /></section>
      <section className="admin-three-grid"><UsageBars overview={overview} /><Adoption analytics={analytics} households={overview.households} /><Card className="admin-panel admin-health"><PanelHead eyebrow="Account health" title="Signals that matter" icon={ShieldCheck} /><div><span><CheckCircle2 /> Task completion</span><strong>{analytics.taskCompletionRate || 0}%</strong></div><div><span><Activity /> Active families</span><strong>{activePercent}%</strong></div><div><span><Mail /> Pending invites</span><strong>{overview.pendingInvites || 0}</strong></div><div><span><CreditCard /> Failed payments</span><strong>{analytics.failedPayments || 0}</strong></div></Card><Card className="admin-panel admin-latest-feed"><PanelHead eyebrow="Inbox" title="Latest messages" icon={MessageCircle} action={<button className="admin-feed-all" onClick={() => setSection("support")}>View all</button>} />
        {latestSupportMessages.length > 0 ? latestSupportMessages.slice(0, 4).map((message) => (
          <article key={message.id} className="admin-feed-row" onClick={() => { setSupportSelected(message.id); setSupportRefreshKey((prev) => prev + 1); }}>
            <span className={`admin-feed-cat-dot admin-cat-${message.category}`} />
            <div className="admin-feed-body">
              <strong>{message.subject}</strong>
              <small>{message.sender_email || "Anonymous"} · {message.household_name || "No family"}</small>
            </div>
            <span className={`admin-support-status ss-${message.status}`}>{message.status}</span>
          </article>
        )) : <p className="admin-empty">No support messages yet.</p>}
      </Card></section>
      <HouseholdTable households={households.slice(0, 8)} onOpen={setSelected} search={search} setSearch={setSearch} title="Recently created families" /></>}
      {section === "families" && <HouseholdTable households={households} onOpen={setSelected} search={search} setSearch={setSearch} />}
      {section === "operations" && <SaaSOperations onOpenHousehold={setSelected} onOpenSupport={(id) => setSupportSelected(id)}/>}
      {section === "users" && <UsersTable users={users} search={userSearch} setSearch={setUserSearch} onDelete={(user) => setDeleteTarget({ kind: "user", id: user.user_id, email: user.email })} />}
      {section === "revenue" && <><StripeRevenue range={range}/><section className="admin-metrics-grid"><Metric icon={CircleDollarSign} label="Webhook MRR" value={money(overview.mrrCents, overview.currency)} detail="From Stripe webhooks" /><Metric icon={WalletCards} label="Recorded collected" value={money(analytics.revenueCollectedCents, overview.currency)} detail={`Net in ${range} days`} tone="mint" /><Metric icon={Users} label="ARPA" value={money(overview.payingHouseholds ? overview.mrrCents / overview.payingHouseholds : 0, overview.currency)} detail={`${overview.payingHouseholds || 0} paying families`} tone="yellow" /><Metric icon={CreditCard} label="Past due" value={overview.pastDueHouseholds || 0} detail={`${analytics.failedPayments || 0} failed payments`} tone="rose" /></section>
        <section className="admin-revenue-grid"><Card className="admin-panel admin-main-chart"><PanelHead eyebrow="Cash intelligence" title="Net revenue collected" icon={BadgeDollarSign} /><div className="admin-chart-summary"><strong>{money(analytics.revenueCollectedCents, overview.currency)}</strong><span>payments less refunds</span></div><TrendChart series={analytics.series} valueKey="revenueCents" currency /></Card><Card className="admin-panel admin-plan-mix"><PanelHead eyebrow="Subscriptions" title="Plan mix" icon={CreditCard} /><div>{(analytics.plans || []).map((plan) => <article key={`${plan.plan}-${plan.status}`}><span><i className={`status-${plan.status}`} />{plan.plan}</span><strong>{plan.accounts}</strong><small>{plan.status} · {money(plan.mrrCents)} MRR</small></article>)}{!analytics.plans?.length && <p className="admin-empty">No subscriptions recorded yet.</p>}</div></Card></section>
        <TopFamilies families={analytics.topFamilies} onOpen={setSelected} /><HouseholdTable households={households} onOpen={setSelected} search={search} setSearch={setSearch} title="Revenue by family" /></>}
      {section === "promotions" && <Promotions />}
      {section === "updates" && <ProductUpdates />}
      {section === "emails" && <EmailAnalytics />}
      {section === "support" && <SupportMessagesTable messages={supportMessages} onOpen={(id) => { setSupportSelected(id); setSupportRefreshKey((prev) => prev + 1); }} categoryFilter={supportCategoryFilter} setCategoryFilter={setSupportCategoryFilter} statusFilter={supportStatusFilter} setStatusFilter={setSupportStatusFilter} archiveFilter={supportArchiveFilter} setArchiveFilter={setSupportArchiveFilter} search={supportSearch} setSearch={setSupportSearch} />}
      {section === "flags" && <Card className="admin-panel"><PanelHead eyebrow="Per-family controls" title="Feature management" icon={Settings2} /><p className="admin-section-copy">Open a family to configure calendars, meals, groceries, tasks, chat, Fam AI, finance, and communication entitlements.</p><HouseholdTable households={households} onOpen={setSelected} search={search} setSearch={setSearch} /></Card>}
      {section === "audit" && <Card className="admin-table-card"><div className="admin-table-tools"><div><small>Security</small><h2>Admin activity</h2></div></div><div className="admin-audit-list">{audit.map((entry) => <article key={entry.id}><span><ShieldCheck size={15} /></span><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.admin_email} · {entry.target_type} {entry.target_id}</small></div><time>{date(entry.created_at)}</time></article>)}{!audit.length && <div className="admin-empty">No admin actions yet.</div>}</div></Card>}
      {section === "account" && <AdminAccount session={session} onSessionChanged={async () => { const { data } = await supabase.auth.getSession(); setSession(data.session); }} />}
    </main><nav className="admin-mobile-nav">{[nav[0], nav[1], nav[2], nav[4], nav[6], nav[8]].map(([key, label, Icon]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon /><small>{label}</small></button>)}</nav>
    <ConfirmDelete target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} busy={deleteBusy} error={deleteError} />
  </div>;
}
