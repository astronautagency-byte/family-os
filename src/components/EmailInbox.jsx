import { useState, useEffect } from "react";
import { Mail, Check, X, Calendar, ShoppingCart, CheckSquare, FileText, ChevronDown, ChevronUp, Inbox, Sparkles, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";


const TYPE_ICONS = {
  event: { icon: Calendar, color: "var(--color-calendar, #6366f1)", bg: "#eef2ff", label: "Event" },
  task: { icon: CheckSquare, color: "var(--color-tasks, #f59e0b)", bg: "#fffbeb", label: "Task" },
  shopping: { icon: ShoppingCart, color: "var(--color-shopping, #10b981)", bg: "#ecfdf5", label: "Shopping" },
  note: { icon: FileText, color: "var(--color-ink-soft, #6b7280)", bg: "#f9fafb", label: "Note" },
};

function ParsedItemCard({ item, onApprove, onReject }) {
  const config = TYPE_ICONS[item.type] || TYPE_ICONS.note;
  const Icon = config.icon;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: config.bg }}>
        <Icon size={16} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: config.color }}>{config.label}</span>
        </div>
        <p className="text-[13px] font-medium text-[var(--color-ink)] leading-tight">{item.title}</p>
        {item.details && <p className="text-[11.5px] text-[var(--color-ink-soft)] mt-0.5 line-clamp-2">{item.details}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onReject} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-red-50 hover:text-red-500 transition-colors" aria-label="Reject">
          <X size={14} />
        </button>
        <button onClick={onApprove} className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors" style={{ backgroundColor: config.color }} aria-label="Approve">
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}

function EmailCard({ email, onApproveItem, onRejectItem, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const items = email.parsed_items || [];

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden notion-shadow">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-surface-sunken)] transition-colors">
        <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
          <Mail size={16} color="var(--color-accent)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{email.subject || "(no subject)"}</p>
          <p className="text-[11px] text-[var(--color-ink-soft)] truncate">From: {email.from_email} · {items.length} item{items.length !== 1 ? "s" : ""} found</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {email.status === "pending" && items.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-accent-soft)] text-[var(--color-accent)]">{items.length} new</span>
          )}
          {expanded ? <ChevronUp size={16} color="var(--color-ink-faint)" /> : <ChevronDown size={16} color="var(--color-ink-faint)" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--color-border)]">
          {email.body_text && (
            <div className="mt-3 p-3 rounded-lg bg-[var(--color-surface-sunken)] text-[12px] text-[var(--color-ink-soft)] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
              {email.body_text.slice(0, 800)}{email.body_text.length > 800 ? "…" : ""}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wide flex items-center gap-1">
                <Sparkles size={12} /> Parsed items
              </p>
              {items.map((item, idx) => (
                <ParsedItemCard
                  key={idx}
                  item={item}
                  onApprove={() => onApproveItem(email.id, idx)}
                  onReject={() => onRejectItem(email.id, idx)}
                />
              ))}
            </div>
          )}

          {items.length === 0 && (
            <p className="mt-3 text-[12px] text-[var(--color-ink-faint)] italic">No actionable items found in this email.</p>
          )}

          {email.status !== "pending" && (
            <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
              {email.status === "approved" ? "✓ Reviewed and added" : "✕ Dismissed"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmailInbox({ compact = false }) {
  const { user } = useAuth();
  const { household, addTask, addGroceryItem, addEvent } = useFamily();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForwardInfo, setShowForwardInfo] = useState(false);
  const [emailToken, setEmailToken] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const fetchEmails = async () => {
    if (!user || !household) return;
    const { data } = await supabase
      .from("email_inbox")
      .select("*")
      .eq("household_id", household.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setEmails(data || []);
    setLoading(false);
  };

  const getEmailToken = async () => {
    if (!household) return;
    const { data } = await supabase.rpc("get_household_email_token", { hid: household.id });
    if (data) setEmailToken(data);
  };

  useEffect(() => {
    fetchEmails();
    getEmailToken();
  }, [user, household]);

  const forwardingAddress = emailToken ? `add-${emailToken}@fam-os.app` : "";

  const copyForwardingAddress = () => {
    if (forwardingAddress) {
      navigator.clipboard.writeText(forwardingAddress);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const approveItem = async (emailId, itemIndex) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;
    const item = email.parsed_items[itemIndex];
    if (!item) return;

    // Add to appropriate system based on type
    try {
      switch (item.type) {
        case "task":
          await addTask({
            title: item.title,
            notes: item.details || "",
            done: false,
          });
          break;
        case "shopping":
          await addGroceryItem({
            name: item.title,
            quantity: 1,
            category: "Other",
          });
          break;
        case "event":
          // Parse date from details if possible
          const now = new Date();
          const startTime = new Date(now);
          startTime.setHours(9, 0, 0, 0);
          const endTime = new Date(startTime);
          endTime.setHours(10, 0, 0, 0);
          await addEvent({
            title: item.title,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            description: item.details || "",
          });
          break;
        default:
          // Notes - just dismiss
          break;
      }

      // Remove item from parsed_items
      const updatedItems = email.parsed_items.filter((_, i) => i !== itemIndex);
      await supabase
        .from("email_inbox")
        .update({
          parsed_items: updatedItems,
          status: updatedItems.length === 0 ? "approved" : email.status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", emailId);

      fetchEmails();
    } catch (err) {
      console.error("Failed to approve item:", err);
    }
  };

  const rejectItem = async (emailId, itemIndex) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    const updatedItems = email.parsed_items.filter((_, i) => i !== itemIndex);
    await supabase
      .from("email_inbox")
      .update({
        parsed_items: updatedItems,
        status: updatedItems.length === 0 ? "rejected" : email.status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", emailId);

    fetchEmails();
  };

  const pendingCount = emails.filter(e => e.status === "pending").length;

  if (compact) {
    if (pendingCount === 0) return null;
    return (
      <div className="rounded-2xl border border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent-soft)] to-white p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center shrink-0">
            <Inbox size={18} color="white" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[var(--color-ink)]">{pendingCount} forwarded email{pendingCount !== 1 ? "s" : ""} to review</p>
            <p className="text-[11px] text-[var(--color-ink-soft)]">Items parsed and ready to add</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Forwarding address info */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <button onClick={() => setShowForwardInfo(!showForwardInfo)} className="w-full flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
            <Send size={18} color="var(--color-accent)" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[var(--color-ink)]">Forward emails to FamOS</p>
            <p className="text-[11px] text-[var(--color-ink-soft)]">Forward receipts, invites, and reminders — we'll parse them for you</p>
          </div>
          {showForwardInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showForwardInfo && forwardingAddress && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
              <code className="flex-1 text-[13px] text-[var(--color-accent)] font-mono break-all">{forwardingAddress}</code>
              <button onClick={copyForwardingAddress} className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity">
                {copiedEmail ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="text-[12px] text-[var(--color-ink-soft)] space-y-1">
              <p>• Forward any email to this address</p>
              <p>• FamOS extracts events, tasks, and shopping items</p>
              <p>• Review and approve each item before it's added</p>
              <p>• Works with receipts, calendar invites, newsletters, and more</p>
            </div>
          </div>
        )}
      </div>

      {/* Email list */}
      {loading ? (
        <div className="text-center py-8 text-[var(--color-ink-faint)] text-sm">Loading emails…</div>
      ) : emails.length === 0 ? (
        <div className="text-center py-8">
          <Mail size={32} className="mx-auto mb-2 text-[var(--color-ink-faint)]" />
          <p className="text-[13px] text-[var(--color-ink-faint)]">No forwarded emails yet</p>
          <p className="text-[11px] text-[var(--color-ink-faint)] mt-1">Forward an email to your FamOS address to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map(email => (
            <EmailCard
              key={email.id}
              email={email}
              onApproveItem={approveItem}
              onRejectItem={rejectItem}
              onDismiss={() => fetchEmails()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
