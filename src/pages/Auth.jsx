import { useState } from "react";
import { Eye, EyeOff, Home, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, PrimaryButton, TextField } from "../components/ui";

function Shell({ children }) {
  return (
    <main className="min-h-screen px-5 py-10 flex items-center justify-center bg-[var(--color-canvas)]">
      <div className="w-full max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center mb-5 shadow-lg shadow-indigo-200">
          <Home size={25} color="white" />
        </div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">FamilyOS</p>
        {children}
      </div>
    </main>
  );
}

export function AuthLoading() {
  return <Shell><LoaderCircle className="animate-spin mt-8" color="var(--color-accent)" /></Shell>;
}

export function SignIn() {
  const { signIn, signUp, signInWithGoogle, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) return;
    setBusy(true);
    setLocalError("");
    setNotice("");
    try {
      if (creating) {
        const data = await signUp(email, password);
        if (!data.session) setNotice("Account created. Check your email once to confirm it, then sign in.");
      } else await signIn(email, password);
    }
    catch (e) { setLocalError(e.message || "Could not authenticate."); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">Your family, in sync.</h1>
      <p className="text-[14px] text-[var(--color-ink-soft)] mt-2 mb-7">A private space for the two of you to coordinate schedules, errands, and home life.</p>
      <Card className="p-5">
        <button type="button" onClick={async () => { try { await signInWithGoogle(); } catch (e) { setLocalError(e.message); } }} className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[14px] font-semibold text-[var(--color-ink)] mb-4 flex items-center justify-center gap-2">
          <span className="text-[17px] font-bold text-[#4285F4]">G</span> Continue with Google
        </button>
        <div className="flex items-center gap-3 mb-4"><span className="h-px bg-[var(--color-border)] flex-1" /><span className="text-[11px] text-[var(--color-ink-faint)] uppercase">or</span><span className="h-px bg-[var(--color-border)] flex-1" /></div>
        <form onSubmit={submit}>
          <div className="flex items-center gap-2 mb-4"><Mail size={16} color="var(--color-accent)" /><h2 className="font-semibold">{creating ? "Create account" : "Sign in"}</h2></div>
          <TextField type="email" label="Email address" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <TextField type={showPassword ? "text" : "password"} label="Password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={6} required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-soft)] -mt-1 mb-3">
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />} {showPassword ? "Hide password" : "Show password"}
          </button>
          {(localError || error) && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{localError || error}</p>}
          {notice && <p className="text-[12.5px] text-[var(--color-good)] mb-3">{notice}</p>}
          <PrimaryButton type="submit" disabled={busy || !email.trim() || password.length < 6}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</PrimaryButton>
          <button type="button" onClick={() => { setCreating((value) => !value); setLocalError(""); setNotice(""); }} className="w-full text-center text-[12.5px] text-[var(--color-accent)] mt-4">
            {creating ? "Already have an account? Sign in" : "New partner? Create an account"}
          </button>
        </form>
      </Card>
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)] mt-4"><LockKeyhole size={11} /> Only your household can see your data</p>
    </Shell>
  );
}

export function HouseholdOnboarding() {
  const { invitation, createHousehold, acceptInvitation, signOut } = useAuth();
  const [name, setName] = useState("Our family");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action) => {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e.message || "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">Set up your home</h1>
      <p className="text-[14px] text-[var(--color-ink-soft)] mt-2 mb-7">One private household, shared by you and your partner.</p>
      <Card className="p-5">
        {invitation ? (
          <>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">You’re invited</p>
            <h2 className="font-semibold text-[18px] mt-1 mb-1">Join {invitation.households?.name}</h2>
            <p className="text-[13px] text-[var(--color-ink-soft)] mb-5">Accept to share schedules, tasks, groceries, and chat.</p>
            <PrimaryButton disabled={busy} onClick={() => run(acceptInvitation)}>{busy ? "Joining…" : "Join household"}</PrimaryButton>
          </>
        ) : (
          <>
            <TextField label="Household name" value={name} onChange={(e) => setName(e.target.value)} />
            <PrimaryButton disabled={busy || !name.trim()} onClick={() => run(() => createHousehold(name))}>{busy ? "Creating…" : "Create household"}</PrimaryButton>
          </>
        )}
        {error && <p className="text-[12.5px] text-[var(--color-warn)] mt-3">{error}</p>}
      </Card>
      <button onClick={signOut} className="w-full text-center text-[12.5px] text-[var(--color-ink-soft)] mt-5">Sign out</button>
    </Shell>
  );
}
