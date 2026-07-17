import { useEffect, useRef, useState } from "react";
import { LockKeyhole, Send, UsersRound } from "lucide-react";
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
  const [activeThread, setActiveThread] = useState("household");
  const endRef = useRef(null);

  useEffect(() => {
    if (activeThread !== "household" && !chatMembers.some((member) => member.id === activeThread)) {
      setActiveThread("household");
    }
  }, [members, activeThread]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMember = activeThread === "household" ? null : memberById[activeThread];
  const threadMessages = messages.filter((message) => {
    if (activeThread === "household") return !message.recipientId;
    return (message.senderId === currentUserId && message.recipientId === activeThread)
      || (message.senderId === activeThread && message.recipientId === currentUserId);
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length, activeThread]);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || !currentUserId || sending) return;
    setSending(true); setSendError("");
    try { await sendMessage({ text: text.trim(), recipientId: activeThread === "household" ? null : activeThread, senderId: currentUserId }); setText(""); }
    catch (e) { setSendError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  return (
    <div className="h-screen pb-20 flex flex-col">
      <PageHeader eyebrow="Private conversations" title="Chat, minus the chaos." illustration="chat" subtitle="Quick decisions, saved from the scroll." />

      <div className="px-5 mt-1 mb-2 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => { setActiveThread("household"); setSendError(""); }} className="shrink-0 flex items-center gap-2 rounded-full border pl-2 pr-3 py-1.5 transition-colors" style={{ borderColor: activeThread === "household" ? "var(--color-accent)" : "var(--color-border)", backgroundColor: activeThread === "household" ? "var(--color-accent-soft)" : "var(--color-surface)", color: activeThread === "household" ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}><span className="w-7 h-7 rounded-full bg-[var(--pastel-mint)] grid place-items-center"><UsersRound size={14} /></span><span className="text-[12.5px] font-semibold">Everyone</span></button>
        {chatMembers.map((member) => {
          const active = member.id === activeThread;
          return <button key={member.id} onClick={() => { setActiveThread(member.id); setSendError(""); }} className="shrink-0 flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1.5 transition-colors" style={{ borderColor: active ? "var(--color-accent)" : "var(--color-border)", backgroundColor: active ? "var(--color-accent-soft)" : "var(--color-surface)", color: active ? "var(--color-accent-strong)" : "var(--color-ink-soft)" }}><Avatar member={member} size="sm" /><span className="text-[12.5px] font-semibold">{member.name}</span></button>;
        })}
      </div>

      <div className="px-5 mb-2 flex items-center gap-2">
        <LockKeyhole size={12} color="var(--color-ink-faint)" />
        <p className="text-[11.5px] text-[var(--color-ink-faint)]">{activeThread === "household" ? "The all-hands household thread" : activeMember ? `Private chat with ${activeMember.name}` : "Add another family member to start chatting"} · synced live</p>
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
        {threadMessages.length === 0 && <div className="h-full min-h-40 flex flex-col items-center justify-center text-center px-8">{activeMember ? <Avatar member={activeMember} size="lg" /> : <span className="w-14 h-14 rounded-full bg-[var(--pastel-mint)] grid place-items-center text-[var(--color-ink)]"><UsersRound size={24} /></span>}<p className="text-[14px] font-medium mt-3">{activeMember ? `Say hi to ${activeMember.name}` : "Start the household chat"}</p><p className="text-[12px] text-[var(--color-ink-faint)] mt-1">Messages stay inside your shared home space.</p></div>}
        <div ref={endRef} />
      </div>

      {(sendError || dataError) && <p className="px-5 py-2 text-[12px] text-[var(--color-warn)]">{sendError || dataError}</p>}

      <form onSubmit={submit} className="px-4 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center gap-2">
        <div className="shrink-0">{memberById[currentUserId] && <Avatar member={memberById[currentUserId]} />}</div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={activeThread === "household" ? "Tell everyone…" : activeMember ? `Message ${activeMember.name}` : "Select a family member"}
          disabled={activeThread !== "household" && !activeMember}
          className="min-w-0 flex-1 rounded-full bg-[var(--color-surface-sunken)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--color-ink-faint)]"
        />
        <button
          type="submit"
          disabled={!text.trim() || (activeThread !== "household" && !activeMember) || sending}
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
