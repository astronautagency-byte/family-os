import { useEffect, useRef, useState } from "react";
import { LockKeyhole, Send } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, colorVar } from "../components/ui";
import PageHeader from "../components/PageHeader";

function timeLabel(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function Chat() {
  const { user } = useAuth();
  const { memberById, messages, sendMessage, dataError } = useFamily();
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || !user?.id || sending) return;
    setSending(true); setSendError("");
    try { await sendMessage({ text: text.trim() }); setText(""); }
    catch (e) { setSendError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  return (
    <div className="h-screen pb-20 flex flex-col">
      <PageHeader eyebrow="Just the two of you" title="Family chat" />

      <div className="px-5 -mt-1 mb-2 flex items-center gap-2">
        <LockKeyhole size={12} color="var(--color-ink-faint)" />
        <p className="text-[11.5px] text-[var(--color-ink-faint)]">Private to your household · synced live</p>
      </div>

      <div className="px-5 py-3 flex-1 overflow-y-auto space-y-3">
        {messages.map((message) => {
          const sender = memberById[message.senderId];
          const mine = message.senderId === user?.id;
          return (
            <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && sender && <Avatar member={sender} size="sm" />}
              <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className="px-3.5 py-2.5 text-[14px] leading-relaxed"
                  style={{
                    borderRadius: mine ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                    background: mine ? "var(--color-accent)" : "var(--color-surface)",
                    color: mine ? "white" : "var(--color-ink)",
                    border: mine ? "none" : "1px solid var(--color-border)",
                  }}
                >
                  {message.text}
                </div>
                <span className="text-[10px] text-[var(--color-ink-faint)] mt-1 px-1">
                  {sender?.name} · {timeLabel(message.sentAt)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {(sendError || dataError) && <p className="px-5 py-2 text-[12px] text-[var(--color-warn)]">{sendError || dataError}</p>}

      <form onSubmit={submit} className="px-4 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center gap-2">
        <div className="shrink-0">{memberById[user?.id] && <Avatar member={memberById[user.id]} />}</div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message as ${memberById[user?.id]?.name ?? "you"}`}
          className="min-w-0 flex-1 rounded-full bg-[var(--color-surface-sunken)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--color-ink-faint)]"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-35"
          style={{ backgroundColor: colorVar(memberById[user?.id]?.color) }}
          aria-label="Send message"
        >
          <Send size={17} color="white" />
        </button>
      </form>
    </div>
  );
}
