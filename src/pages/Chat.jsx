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
  const { members, memberById, messages, sendMessage, dataError } = useFamily();
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const currentUserId = user?.id || members[0]?.id;
  const chatMembers = members.filter((member) => member.id !== currentUserId);
  const [activeMemberId, setActiveMemberId] = useState(chatMembers[0]?.id || null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!chatMembers.some((member) => member.id === activeMemberId)) setActiveMemberId(chatMembers[0]?.id || null);
  }, [members, activeMemberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMember = memberById[activeMemberId];
  const threadMessages = messages.filter((message) => {
    const direct = (message.senderId === currentUserId && message.recipientId === activeMemberId)
      || (message.senderId === activeMemberId && message.recipientId === currentUserId);
    const legacy = !message.recipientId && (message.senderId === currentUserId || message.senderId === activeMemberId);
    return direct || legacy;
  });

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [threadMessages.length, activeMemberId]);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || !currentUserId || !activeMemberId || sending) return;
    setSending(true); setSendError("");
    try { await sendMessage({ text: text.trim(), recipientId: activeMemberId, senderId: currentUserId }); setText(""); }
    catch (e) { setSendError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  return (
    <div className="h-screen pb-20 flex flex-col">
      <PageHeader eyebrow="Private conversations" title="Family chat" />

      <div className="px-5 mt-1 mb-2 flex gap-2 overflow-x-auto pb-1">
        {chatMembers.map((member) => {
          const active = member.id === activeMemberId;
          return <button key={member.id} onClick={() => { setActiveMemberId(member.id); setSendError(""); }} className="shrink-0 flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1.5 transition-colors" style={{ borderColor: active ? "var(--color-accent)" : "var(--color-border)", backgroundColor: active ? "var(--color-accent-soft)" : "var(--color-surface)", color: active ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}><Avatar member={member} size="sm" /><span className="text-[12.5px] font-semibold">{member.name}</span></button>;
        })}
      </div>

      <div className="px-5 mb-2 flex items-center gap-2">
        <LockKeyhole size={12} color="var(--color-ink-faint)" />
        <p className="text-[11.5px] text-[var(--color-ink-faint)]">{activeMember ? `Private chat with ${activeMember.name}` : "Add another family member to start chatting"} · synced live</p>
      </div>

      <div className="px-5 py-3 flex-1 overflow-y-auto space-y-3">
        {threadMessages.map((message) => {
          const sender = memberById[message.senderId];
          const mine = message.senderId === currentUserId;
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
        {activeMember && threadMessages.length === 0 && <div className="h-full min-h-40 flex flex-col items-center justify-center text-center px-8"><Avatar member={activeMember} size="lg" /><p className="text-[14px] font-medium mt-3">Start a conversation with {activeMember.name}</p><p className="text-[12px] text-[var(--color-ink-faint)] mt-1">Messages stay private to your household.</p></div>}
        <div ref={endRef} />
      </div>

      {(sendError || dataError) && <p className="px-5 py-2 text-[12px] text-[var(--color-warn)]">{sendError || dataError}</p>}

      <form onSubmit={submit} className="px-4 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center gap-2">
        <div className="shrink-0">{memberById[currentUserId] && <Avatar member={memberById[currentUserId]} />}</div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={activeMember ? `Message ${activeMember.name}` : "Select a family member"}
          disabled={!activeMember}
          className="min-w-0 flex-1 rounded-full bg-[var(--color-surface-sunken)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--color-ink-faint)]"
        />
        <button
          type="submit"
          disabled={!text.trim() || !activeMember || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-35"
          style={{ backgroundColor: colorVar(memberById[currentUserId]?.color) }}
          aria-label="Send message"
        >
          <Send size={17} color="white" />
        </button>
      </form>
    </div>
  );
}
