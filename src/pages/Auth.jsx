import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, PrimaryButton, TextField } from "../components/ui";

function Shell({ children }) {
  return (
    <main className="minimal-auth">
      <div className="minimal-auth-inner">
        <img src="/brand/famos-logo.png" alt="FamOS" className="minimal-auth-logo" />
        {children}
      </div>
    </main>
  );
}

export function AuthLoading() {
  return <Shell><LoaderCircle className="animate-spin mt-8" color="var(--color-accent)" /></Shell>;
}

export function SignIn({ initialCreating = false }) {
  const { signIn, signUp, signInWithGoogle, requestPasswordReset, error } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(initialCreating);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgot, setForgot] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6 || (creating && !displayName.trim())) return;
    setBusy(true);
    setLocalError("");
    setNotice("");
    try {
      if (creating) {
        const data = await signUp(email, password, displayName);
        if (!data.session) setNotice("Account created. Check your email once to confirm it, then sign in.");
      } else await signIn(email, password);
    }
    catch (e) { setLocalError(e.message || "Could not authenticate."); }
    finally { setBusy(false); }
  };

  if (forgot) return <ForgotPassword onBack={() => setForgot(false)} requestPasswordReset={requestPasswordReset} initialEmail={email} />;

  return (
    <Shell>
      <h1 className="minimal-auth-title">{creating ? "Create your account" : "Welcome back"}</h1>
      <Card className="minimal-auth-card">
        <form onSubmit={submit}>
          {creating && <TextField label="Your name" placeholder="e.g. Kat" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required />}
          <TextField type="email" label="Email address" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <TextField type={showPassword ? "text" : "password"} label="Password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={6} required />
          <div className="password-actions"><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />} {showPassword ? "Hide password" : "Show password"}</button>{!creating&&<button type="button" onClick={()=>setForgot(true)}>Forgot?</button>}</div>
          {(localError || error) && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{localError || error}</p>}
          {notice && <p className="text-[12.5px] text-[var(--color-good)] mb-3">{notice}</p>}
          <PrimaryButton type="submit" disabled={busy || !email.trim() || password.length < 6 || (creating && !displayName.trim())}>{busy ? "Please wait…" : creating ? "Create account" : "Sign in"}</PrimaryButton>
          <div className="minimal-or"><span />OR<span /></div>
          <button type="button" onClick={async () => { try { await signInWithGoogle(); } catch (e) { setLocalError(e.message); } }} className="minimal-google">
            <GoogleMark /> Continue with Google
          </button>
          <button type="button" onClick={() => { setCreating((value) => !value); setLocalError(""); setNotice(""); }} className="w-full text-center text-[12.5px] text-[var(--color-accent)] mt-4">
            {creating ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </form>
      </Card>
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)] mt-4"><LockKeyhole size={11} /> Only your household can see your data</p>
    </Shell>
  );
}

function ForgotPassword({ onBack, requestPasswordReset, initialEmail }) {
  const [email,setEmail]=useState(initialEmail||""); const [busy,setBusy]=useState(false); const [sent,setSent]=useState(false); const [error,setError]=useState("");
  const submit=async(e)=>{e.preventDefault();if(!email.trim())return;setBusy(true);setError("");try{await requestPasswordReset(email);setSent(true)}catch(err){setError(err.message||"Could not send reset email.")}finally{setBusy(false)}};
  return <Shell><h1 className="minimal-auth-title">Reset password</h1><p className="recovery-intro">{sent?"Check your inbox for a secure password-reset link.":"Enter the email address connected to your FamilyOS account."}</p><Card className="minimal-auth-card">{sent?<><div className="recovery-sent"><MailIcon/><strong>Email sent</strong><span>We sent a recovery link to {email}.</span></div><button className="minimal-google" onClick={onBack}>Back to sign in</button></>:<form onSubmit={submit}><TextField type="email" label="Email address" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/>{error&&<p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}<PrimaryButton type="submit" disabled={busy||!email.trim()}>{busy?"Sending…":"Send reset link"}</PrimaryButton><button type="button" className="recovery-back" onClick={onBack}>Back to sign in</button></form>}</Card></Shell>;
}

function MailIcon(){return <span className="recovery-mail">@</span>}

function GoogleMark(){return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>}

export function ResetPassword(){
 const {updatePassword}=useAuth(); const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [show,setShow]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const valid=password.length>=6&&password===confirm;
 const submit=async(e)=>{e.preventDefault();if(!valid)return;setBusy(true);setError("");try{await updatePassword(password)}catch(err){setError(err.message||"Could not update password.");setBusy(false)}};
 return <Shell><h1 className="minimal-auth-title">Choose a new password</h1><p className="recovery-intro">Use at least six characters and choose something you don’t use elsewhere.</p><Card className="minimal-auth-card"><form onSubmit={submit}><TextField type={show?"text":"password"} label="New password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={6} required/><TextField type={show?"text":"password"} label="Confirm password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required/><div className="password-actions"><button type="button" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={16}/>:<Eye size={16}/>} {show?"Hide passwords":"Show passwords"}</button></div>{confirm&&password!==confirm&&<p className="text-[12.5px] text-[var(--color-warn)] mb-3">Passwords do not match.</p>}{error&&<p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}<PrimaryButton type="submit" disabled={busy||!valid}>{busy?"Saving…":"Save new password"}</PrimaryButton></form></Card></Shell>;
}

export function HouseholdOnboarding() {
  const { invitation, household, createHousehold, acceptInvitation, invitePartner, signOut, refreshAccount, session } = useAuth();
  const [name, setName] = useState("Our family");
  const [inviteEmails, setInviteEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action) => {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e.message || "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="minimal-auth-title">{household ? "Invite your family" : "Name your family"}</h1>
      <p className="recovery-intro">{household ? `Add at least one member to ${household.name} before continuing.` : "Create the private family space everyone will share."}</p>
      <Card className="p-5">
        {invitation ? (
          <>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">You’re invited</p>
            <h2 className="font-semibold text-[18px] mt-1 mb-1">Join {invitation.households?.name}</h2>
            <p className="text-[13px] text-[var(--color-ink-soft)] mb-5">Accept to share schedules, tasks, groceries, and chat.</p>
            <PrimaryButton disabled={busy} onClick={() => run(acceptInvitation)}>{busy ? "Joining…" : "Join household"}</PrimaryButton>
          </>
        ) : !household ? (
          <>
            <TextField label="Family name" placeholder="e.g. The Miller Family" value={name} onChange={(e) => setName(e.target.value)} />
            <PrimaryButton disabled={busy || !name.trim()} onClick={() => run(() => createHousehold(name))}>{busy ? "Creating…" : "Continue"}</PrimaryButton>
          </>
        ) : (
          <><TextField type="text" label="Family member emails" placeholder="alex@example.com, sam@example.com" value={inviteEmails} onChange={(e)=>setInviteEmails(e.target.value)}/><p className="onboarding-hint">Separate multiple email addresses with commas. Each person will receive a secure FamilyOS signup invitation.</p><PrimaryButton disabled={busy||!inviteEmails.trim()} onClick={()=>run(async()=>{const emails=inviteEmails.split(",").map(value=>value.trim()).filter(Boolean);for(const email of emails)await invitePartner(email)})}>{busy?"Sending invitations…":"Send invitations & continue"}</PrimaryButton></>
        )}
        {error && <div className="onboarding-recovery"><p>{error}</p>{/already belong to a household/i.test(error)&&<button disabled={busy} onClick={()=>run(()=>refreshAccount(session))}>Open my existing household</button>}</div>}
      </Card>
      <button onClick={signOut} className="w-full text-center text-[12.5px] text-[var(--color-ink-soft)] mt-5">Sign out</button>
    </Shell>
  );
}
