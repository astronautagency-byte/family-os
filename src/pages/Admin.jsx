import { useEffect, useMemo, useState } from "react";
import {
  Activity, Archive, ArrowLeft, BadgeDollarSign, Building2, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, CreditCard, Flag, LayoutDashboard, ListChecks, LogOut, Mail, MessageCircle,
  Search, Send, Settings2, ShieldCheck, ShoppingCart, Tag, Trash2, TrendingUp, UserPlus, Users, Utensils,
  WalletCards, XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, Modal, PrimaryButton, TextField } from "../components/ui";
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
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const { data: resolvedEmail, error: resolveError } = await supabase.rpc("admin_login_email", { login_name: login.trim() });
    if (resolveError || !resolvedEmail) { setError("That admin username or email is not recognized."); setBusy(false); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
    if (signInError) setError(signInError.message); else onSignedIn();
    setBusy(false);
  };
  return <main className="admin-login"><form onSubmit={submit} className="admin-login-card">
    <img src="/brand/famos-icon-transparent.png" alt="FamOS" />
    <span className="admin-kicker"><ShieldCheck size={14} /> FamOS operations</span>
    <h1>Admin sign in</h1><p>Secure access for authorized FamOS operators.</p>
    <TextField label="Admin username or email" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
    <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
    {error && <div className="admin-error">{error}</div>}
    <PrimaryButton type="submit" disabled={busy || !login || !password}>{busy ? "Checking access…" : "Open admin dashboard"}</PrimaryButton>
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
    <Card className="admin-panel"><PanelHead eyebrow="Sign-in identity" title="Admin profile" icon={ShieldCheck} /><p className="admin-section-copy">Use a unique administrator username. This identity stays separate from family accounts.</p><div className="admin-account-form"><TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} /><PrimaryButton disabled={busy || username.length < 3} onClick={() => run("username", supabase.rpc("admin_update_own_username", { next_username: username }), "Admin username updated.")}>Save username</PrimaryButton></div></Card>
    <Card className="admin-panel"><PanelHead eyebrow="Recovery & notices" title="Login email" icon={Mail} /><p className="admin-section-copy">Supabase confirms a new address before it becomes active.</p><div className="admin-account-form"><TextField label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><PrimaryButton disabled={busy || !email || email === session.user.email} onClick={() => run("email", supabase.auth.updateUser({ email: email.trim().toLowerCase() }), "Check the new email address to confirm the change.")}>Change email</PrimaryButton></div></Card>
    <Card className="admin-panel"><PanelHead eyebrow="Security" title="Change password" icon={Settings2} /><div className="admin-account-form"><TextField label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><TextField label="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /><PrimaryButton disabled={busy || password.length < 10 || password !== confirmPassword} onClick={async () => { await run("password", supabase.auth.updateUser({ password }), "Password updated successfully."); setPassword(""); setConfirmPassword(""); }}>Update password</PrimaryButton></div></Card>
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
  const rows = [["Tasks", overview.tasks30d, ListChecks, "#7155df"], ["Chats", overview.messages30d, MessageCircle, "#4f8fc9"], ["Events", overview.events30d, CalendarDays, "#d58a35"], ["Groceries", overview.groceries30d, ShoppingCart, "#388b73"], ["Meals", overview.meals30d, Utensils, "#d36b83"]];
  const max = Math.max(...rows.map((row) => row[1] || 0), 1);
  return <Card className="admin-panel"><PanelHead eyebrow="Last 30 days" title="Product activity" icon={Activity} /><div className="admin-bars">{rows.map(([label, value, Icon, color]) => <div key={label}><span><Icon size={15} />{label}</span><i><b style={{ width: `${Math.max(3, value / max * 100)}%`, background: color }} /></i><strong>{value || 0}</strong></div>)}</div></Card>;
}

function Adoption({ analytics, households }) {
  const items = [["Tasks", "tasks", "#7257df"], ["Chat", "chat", "#5f9bc9"], ["Calendar", "calendar", "#dfa14d"], ["Groceries", "groceries", "#4aa487"], ["Meals", "meals", "#d97991"]];
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
    <section className="admin-detail-section"><PanelHead eyebrow="Commercial" title="Plan & revenue" icon={CircleDollarSign} /><div className="admin-plan-form">
      <label>Plan<input value={plan.plan} onChange={(event) => setPlan({ ...plan, plan: event.target.value })} /></label><label>Status<select value={plan.status} onChange={(event) => setPlan({ ...plan, status: event.target.value })}><option>trial</option><option>active</option><option>past_due</option><option>canceled</option><option>paused</option></select></label>
      <label>Amount in cents<input type="number" value={plan.amount} onChange={(event) => setPlan({ ...plan, amount: event.target.value })} /></label><label>Interval<select value={plan.interval} onChange={(event) => setPlan({ ...plan, interval: event.target.value })}><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
      <button disabled={busy} onClick={() => act("plan", supabase.rpc("admin_upsert_subscription", { target_household: id, next_plan: plan.plan, next_status: plan.status, next_amount_cents: Number(plan.amount), next_currency: plan.currency, next_interval: plan.interval }))}>Save billing</button>
    </div><div className="admin-payment-form"><select value={payment.type} onChange={(event) => setPayment({ ...payment, type: event.target.value })}><option value="invoice_paid">Payment received</option><option value="payment_failed">Payment failed</option><option value="refund">Refund</option><option value="subscription_canceled">Canceled</option></select><input type="number" placeholder="Amount in cents" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /><input placeholder="Internal note" value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} /><button disabled={busy || payment.amount === ""} onClick={async () => { await act("payment", supabase.rpc("admin_record_billing_event", { target_household: id, next_event_type: payment.type, next_amount_cents: Number(payment.amount), next_currency: plan.currency, event_note: payment.note })); setPayment({ type: "invoice_paid", amount: "", note: "" }); }}>Record event</button></div></section>
    <section className="admin-danger"><div><strong>Account access</strong><small>Suspend access without deleting family data.</small></div><select value={household.status} disabled={busy} onChange={(event) => act("status", supabase.rpc("admin_set_household_status", { target_household: id, next_status: event.target.value, status_note: "Changed from FamOS admin" }))}><option>active</option><option>trial</option><option>past_due</option><option>suspended</option><option>disabled</option></select></section>
    <section className="admin-danger destructive"><div><strong>Delete family account</strong><small>Permanently removes the family, its users, and all associated data.</small></div><button onClick={() => onDelete({ kind: "household", id, name: household.name })}><Trash2 size={15} /> Delete account</button></section>
  </div>;
}

function TopFamilies({ families = [], onOpen }) {
  const max = Math.max(...families.map((item) => Number(item.activity_count || 0)), 1);
  return <Card className="admin-panel admin-top-families"><PanelHead eyebrow="Engagement" title="Top families" icon={TrendingUp} /><div>{families.map((family, index) => <button key={family.id} onClick={() => onOpen(family.id)}><span>{index + 1}</span><div><strong>{family.name}</strong><small>{family.plan} · {money(family.mrr_cents)} MRR</small><i><em style={{ width: `${Number(family.activity_count || 0) / max * 100}%` }} /></i></div><b>{number(family.activity_count)}</b></button>)}{!families.length && <p className="admin-empty">Activity will appear as families use FamOS.</p>}</div></Card>;
}

function SupportMessagesTable({ messages, onOpen, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, search, setSearch }) {
  return <Card className="admin-table-card">
    <div className="admin-table-tools">
      <div><small>Inbox</small><h2>Support messages</h2></div>
      <div className="admin-support-filters">
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          <option value="email">Email</option>
          <option value="bug">Bug reports</option>
          <option value="ticket">Support tickets</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
        </select>
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages…" /></label>
      </div>
    </div>
    <div className="admin-table-scroll"><table><thead><tr><th>Subject</th><th>Category</th><th>From</th><th>Household</th><th>Priority</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
      {messages.map((message) => <tr key={message.id} onClick={() => onOpen(message.id)}>
        <td><strong>{message.subject}</strong></td>
        <td><span className={`admin-support-cat admin-cat-${message.category}`}>{message.category === "bug" ? "Bug" : message.category === "ticket" ? "Ticket" : "Email"}</span></td>
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

function SupportMessageDetail({ id, onClose, onChanged }) {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
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
  if (!message) return <div className="admin-detail-loading">Loading message…</div>;
  const categoryIcon = message.category === "bug" ? Bug : message.category === "ticket" ? Ticket : Mail;
  return <div className="admin-detail"><header>
    <button onClick={onClose}><ArrowLeft size={18} /> Support messages</button>
    <div className="admin-support-detail-status">
      <span className={`admin-support-status ss-${message.status}`}>{message.status}</span>
      {message.status !== "read" && <button disabled={!!busy} onClick={() => updateStatus("read")}><CheckCircle2 size={14} /> {busy === "status" ? "…" : "Mark read"}</button>}
      {message.status !== "replied" && <button disabled={!!busy} onClick={() => updateStatus("replied")}><Send size={14} /> {busy === "status" ? "…" : "Mark replied"}</button>}
      {message.status !== "closed" && <button disabled={!!busy} onClick={() => updateStatus("closed")}><Archive size={14} /> {busy === "status" ? "…" : "Close"}</button>}
    </div>
  </header>
    {error && <div className="admin-error">{error}</div>}
    <Card className="admin-panel admin-support-detail-card">
      <div className="admin-support-detail-head">
        <span className="admin-support-detail-icon">{categoryIcon ? <categoryIcon size={22} /> : <Mail size={22} />}</span>
        <div>
          <div className="admin-support-detail-meta">
            <span className={`admin-support-cat admin-cat-${message.category}`}>{message.category === "bug" ? "Bug report" : message.category === "ticket" ? "Support ticket" : "Email"}</span>
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
  </div>;
}

export default function Admin() {
  const [checking, setChecking] = useState(true); const [session, setSession] = useState(null); const [allowed, setAllowed] = useState(false);
  const [section, setSection] = useState("overview"); const [overview, setOverview] = useState({}); const [analytics, setAnalytics] = useState({});
  const [households, setHouseholds] = useState([]); const [users, setUsers] = useState([]); const [audit, setAudit] = useState([]);
  const [search, setSearch] = useState(""); const [userSearch, setUserSearch] = useState(""); const [selected, setSelected] = useState(null);
  const [range, setRange] = useState(90); const [error, setError] = useState(""); const [deleteTarget, setDeleteTarget] = useState(null); const [deleteBusy, setDeleteBusy] = useState(false); const [deleteError, setDeleteError] = useState("");
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportCategoryFilter, setSupportCategoryFilter] = useState("");
  const [supportStatusFilter, setSupportStatusFilter] = useState("");
  const [supportSelected, setSupportSelected] = useState(null);
  const [supportRefreshKey, setSupportRefreshKey] = useState(0);
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
    if (!allowed || section !== "support") return;
    const loadSupport = async () => {
      const { data, error: supportError } = await supabase.rpc("admin_list_support_messages", {
        category_filter: supportCategoryFilter, status_filter: supportStatusFilter, search_text: supportSearch, page_limit: 200, page_offset: 0,
      });
      if (supportError) setError(supportError.message);
      else setSupportMessages(data || []);
    };
    loadSupport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, section, supportCategoryFilter, supportStatusFilter, supportSearch, supportRefreshKey]);
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
  if (checking) return <main className="admin-loading">Checking admin access…</main>;
  if (!session) return <AdminLogin onSignedIn={check} />;
  if (!allowed) return <main className="admin-denied"><XCircle /><h1>Admin access required</h1><p>{error}</p><button onClick={async () => { await supabase.auth.signOut(); setSession(null); }}>Use another account</button></main>;
  if (supportSelected) return <main className="admin-shell admin-detail-shell"><SupportMessageDetail id={supportSelected} onClose={() => setSupportSelected(null)} onChanged={() => setSupportRefreshKey((prev) => prev + 1)} /></main>;
  if (selected) return <main className="admin-shell admin-detail-shell"><HouseholdDetail id={selected} onClose={() => setSelected(null)} onChanged={load} onDelete={setDeleteTarget} /><ConfirmDelete target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} busy={deleteBusy} error={deleteError} /></main>;
  const nav = [["overview", "Overview", LayoutDashboard], ["families", "Families", Building2], ["users", "Users", Users], ["revenue", "Revenue", BadgeDollarSign], ["support", "Support", MessageCircle], ["flags", "Feature flags", Flag], ["audit", "Audit log", ShieldCheck], ["account", "Admin account", Settings2]];
  const activePercent = overview.households ? Math.round(Number(analytics.activeHouseholds30d || 0) / Number(overview.households) * 100) : 0;
  return <div className="admin-shell"><aside><div className="admin-brand"><span className="admin-brand-icon"><img src="/brand/famos-icon.png" alt="FamOS" /></span><strong>Fam<span>OS</span></strong><small>Admin</small></div><nav>{nav.map(([key, label, Icon]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={18} />{label}</button>)}</nav><button className="admin-signout" onClick={async () => { await supabase.auth.signOut(); setSession(null); }}><LogOut size={17} /> Sign out</button></aside>
    <main><header className="admin-topbar"><div><span className="admin-kicker"><ShieldCheck size={13} /> Operations center</span><h1>{nav.find(([key]) => key === section)?.[1]}</h1></div><div className="admin-topbar-actions">{["overview", "revenue"].includes(section) && <select value={range} onChange={(event) => setRange(Number(event.target.value))}><option value="30">30 days</option><option value="90">90 days</option><option value="365">12 months</option></select>}<div className="admin-operator"><span>{session.user.email?.[0]?.toUpperCase()}</span><small>{session.user.email}</small></div></div></header>
      {error && <div className="admin-error">{error}</div>}
      {section === "overview" && <><section className="admin-metrics-grid">
        <Metric icon={Building2} label="Total families" value={number(overview.households)} detail={`${analytics.activeHouseholds30d || 0} active in 30d`} />
        <Metric icon={Users} label="Total users" value={number(overview.users)} detail={`${overview.activeUsers30d || 0} signed in recently`} tone="mint" />
        <Metric icon={CircleDollarSign} label="MRR" value={money(overview.mrrCents, overview.currency)} detail={`${money(overview.arrCents, overview.currency)} ARR`} tone="yellow" />
        <Metric icon={Activity} label="Engagement" value={`${activePercent}%`} detail={`${analytics.activeHouseholds7d || 0} active families this week`} tone="rose" />
      </section>
      <section className="admin-analytics-grid"><Card className="admin-panel admin-main-chart"><PanelHead eyebrow={`${range}-day intelligence`} title="Product engagement" icon={TrendingUp} /><div className="admin-chart-summary"><strong>{number((analytics.series || []).reduce((sum, item) => sum + ["tasks", "chats", "events", "groceries", "meals"].reduce((inner, key) => inner + Number(item[key] || 0), 0), 0))}</strong><span>actions across FamOS</span></div><TrendChart series={analytics.series} /></Card><TopFamilies families={analytics.topFamilies} onOpen={setSelected} /></section>
      <section className="admin-three-grid"><UsageBars overview={overview} /><Adoption analytics={analytics} households={overview.households} /><Card className="admin-panel admin-health"><PanelHead eyebrow="Account health" title="Signals that matter" icon={ShieldCheck} /><div><span><CheckCircle2 /> Task completion</span><strong>{analytics.taskCompletionRate || 0}%</strong></div><div><span><Activity /> Active families</span><strong>{activePercent}%</strong></div><div><span><Mail /> Pending invites</span><strong>{overview.pendingInvites || 0}</strong></div><div><span><CreditCard /> Failed payments</span><strong>{analytics.failedPayments || 0}</strong></div></Card></section>
      <HouseholdTable households={households.slice(0, 8)} onOpen={setSelected} search={search} setSearch={setSearch} title="Recently created families" /></>}
      {section === "families" && <HouseholdTable households={households} onOpen={setSelected} search={search} setSearch={setSearch} />}
      {section === "users" && <UsersTable users={users} search={userSearch} setSearch={setUserSearch} onDelete={(user) => setDeleteTarget({ kind: "user", id: user.user_id, email: user.email })} />}
      {section === "revenue" && <><section className="admin-metrics-grid"><Metric icon={CircleDollarSign} label="MRR" value={money(overview.mrrCents, overview.currency)} detail="Active subscriptions" /><Metric icon={WalletCards} label="Collected" value={money(analytics.revenueCollectedCents, overview.currency)} detail={`Net in ${range} days`} tone="mint" /><Metric icon={Users} label="ARPA" value={money(overview.payingHouseholds ? overview.mrrCents / overview.payingHouseholds : 0, overview.currency)} detail={`${overview.payingHouseholds || 0} paying families`} tone="yellow" /><Metric icon={CreditCard} label="Past due" value={overview.pastDueHouseholds || 0} detail={`${analytics.failedPayments || 0} failed payments`} tone="rose" /></section>
        <section className="admin-revenue-grid"><Card className="admin-panel admin-main-chart"><PanelHead eyebrow="Cash intelligence" title="Net revenue collected" icon={BadgeDollarSign} /><div className="admin-chart-summary"><strong>{money(analytics.revenueCollectedCents, overview.currency)}</strong><span>payments less refunds</span></div><TrendChart series={analytics.series} valueKey="revenueCents" currency /></Card><Card className="admin-panel admin-plan-mix"><PanelHead eyebrow="Subscriptions" title="Plan mix" icon={CreditCard} /><div>{(analytics.plans || []).map((plan) => <article key={`${plan.plan}-${plan.status}`}><span><i className={`status-${plan.status}`} />{plan.plan}</span><strong>{plan.accounts}</strong><small>{plan.status} · {money(plan.mrrCents)} MRR</small></article>)}{!analytics.plans?.length && <p className="admin-empty">No subscriptions recorded yet.</p>}</div></Card></section>
        <TopFamilies families={analytics.topFamilies} onOpen={setSelected} /><HouseholdTable households={households} onOpen={setSelected} search={search} setSearch={setSearch} title="Revenue by family" /></>}
      {section === "support" && <SupportMessagesTable messages={supportMessages} onOpen={setSupportSelected} categoryFilter={supportCategoryFilter} setCategoryFilter={setSupportCategoryFilter} statusFilter={supportStatusFilter} setStatusFilter={setSupportStatusFilter} search={supportSearch} setSearch={setSupportSearch} />}
      {section === "flags" && <Card className="admin-panel"><PanelHead eyebrow="Per-family controls" title="Feature management" icon={Settings2} /><p className="admin-section-copy">Open a family to configure calendars, meals, groceries, tasks, chat, Fam AI, finance, and communication entitlements.</p><HouseholdTable households={households} onOpen={setSelected} search={search} setSearch={setSearch} /></Card>}
      {section === "audit" && <Card className="admin-table-card"><div className="admin-table-tools"><div><small>Security</small><h2>Admin activity</h2></div></div><div className="admin-audit-list">{audit.map((entry) => <article key={entry.id}><span><ShieldCheck size={15} /></span><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.admin_email} · {entry.target_type} {entry.target_id}</small></div><time>{date(entry.created_at)}</time></article>)}{!audit.length && <div className="admin-empty">No admin actions yet.</div>}</div></Card>}
      {section === "account" && <AdminAccount session={session} onSessionChanged={async () => { const { data } = await supabase.auth.getSession(); setSession(data.session); }} />}
    </main><nav className="admin-mobile-nav">{[nav[0], nav[1], nav[2], nav[3], nav[4], nav[6]].map(([key, label, Icon]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon /><small>{label}</small></button>)}</nav>
    <ConfirmDelete target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} busy={deleteBusy} error={deleteError} />
  </div>;
}
