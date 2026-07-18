import { useEffect, useMemo, useState } from "react";
import { Baby, BriefcaseBusiness, CalendarDays, Check, CheckSquare, ChefHat, ChevronLeft, Eye, EyeOff, HeartHandshake, House, ImagePlus, Leaf, LoaderCircle, LockKeyhole, Mail, MessageCircle, Palette, Plus, Salad, ShieldCheck, ShoppingCart, Sparkles, Trash2, UserRound, UsersRound, WalletCards, WheatOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, PrimaryButton, SecondaryButton, TextField } from "../components/ui";
import { FAMILY_COLORS } from "../data/mockData";
import { AVATAR_PRESETS } from "../data/avatarLibrary";
import AddressAutocomplete from "../components/AddressAutocomplete";
import { formatPhoneInput, isValidPhoneNumber, normalizePhoneE164 } from "../utils/phone";

function resizeAvatarImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 360;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const sourceSize = Math.min(image.width, image.height);
        context.drawImage(image, (image.width - sourceSize) / 2, (image.height - sourceSize) / 2, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const newInviteMember = () => ({ name: "", email: "", phone: "", smsConsent: false });

function Shell({ children, wide = false }) {
  return (
    <main className="minimal-auth">
      <div className={`minimal-auth-inner ${wide ? "minimal-auth-inner-wide" : ""}`}>
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
  const { signIn, signUp, requestPasswordReset, requestInvitePasswordCode, error } = useAuth();
  const inviteParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const openedInvitation = inviteParams.get("invited") === "1";
  const [email, setEmail] = useState(() => inviteParams.get("email") || "");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(initialCreating);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState(() => openedInvitation ? "Already registered? Sign in normally. New invited members can create a password below." : "");
  const [forgot, setForgot] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6 || (creating && !displayName.trim())) return;
    setBusy(true);
    setLocalError("");
    setNotice("");
    setNeedsPasswordSetup(false);
    try {
      if (creating) {
        const data = await signUp(email, password, displayName);
        if (!data.session) setNotice("Account created. Check your email, then sign in.");
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      const invitedAccount = e.message === "INVITED_ACCOUNT_PASSWORD_REQUIRED";
      setLocalError(invitedAccount ? "" : e.message || "Could not sign in. Please try again.");
      setNeedsPasswordSetup(invitedAccount);
    } finally {
      setBusy(false);
    }
  };

  if (forgot) {
    return <ForgotPassword onBack={() => setForgot(false)} requestPasswordReset={requestPasswordReset} initialEmail={email} />;
  }
  if (needsPasswordSetup) {
    return (
      <InvitedPasswordSetup
        initialEmail={email}
        requestCode={requestInvitePasswordCode}
        onBack={() => { setNeedsPasswordSetup(false); setLocalError(""); setPassword(""); }}
      />
    );
  }

  return (
    <Shell>
      <h1 className="minimal-auth-title">{creating ? "Create your FamOS account" : "Welcome back"}</h1>
      <p className="minimal-auth-subtitle">
        {creating
          ? "Create an account. You can connect Google Calendar during setup."
          : "Use the email and password for your FamOS account."}
      </p>
      <Card className="minimal-auth-card">
        <form onSubmit={submit}>
          {creating && <TextField label="Your name" placeholder="e.g. Kat" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required />}
          <TextField type="email" label="Email address" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <TextField type={showPassword ? "text" : "password"} label="Password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={6} required />
          <div className="password-actions">
            <button type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />} {showPassword ? "Hide password" : "Show password"}
            </button>
            {!creating && <button type="button" onClick={() => setForgot(true)}>Forgot?</button>}
          </div>
          {(localError || error) && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{localError || error}</p>}
          {notice && <p className="text-[12.5px] text-[var(--color-good)] mb-3">{notice}</p>}
          <PrimaryButton type="submit" disabled={busy || !email.trim() || password.length < 6 || (creating && !displayName.trim())}>
            {busy ? "One sec…" : creating ? "Create account" : "Sign in"}
          </PrimaryButton>
          {!creating && openedInvitation && (
            <button type="button" onClick={() => { setNeedsPasswordSetup(true); setLocalError(""); }} className="w-full text-center text-[12.5px] text-[var(--color-accent)] mt-4">
              New invited member? Create your password
            </button>
          )}
          <button type="button" onClick={() => { setCreating((value) => !value); setLocalError(""); setNotice(""); }} className="w-full text-center text-[12.5px] text-[var(--color-accent)] mt-4">
            {creating ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </form>
      </Card>
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)] mt-4"><LockKeyhole size={11} /> Only your household can see your data</p>
    </Shell>
  );
}

function InvitedPasswordSetup({ initialEmail, requestCode, onBack }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendLink = async (event) => {
    event?.preventDefault?.();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestCode(email);
      setLinkSent(true);
    } catch (err) {
      setError(err.message || "Could not send the secure setup link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="minimal-auth-title">Create your password</h1>
      <p className="recovery-intro">
        {linkSent
          ? `Open the secure link sent to ${email} to create your password and join your family.`
          : "Enter the email that received your FamOS invitation."}
      </p>
      <Card className="minimal-auth-card">
        {!linkSent ? (
          <form onSubmit={sendLink}>
            <TextField type="email" label="Invited email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            {error && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}
            <PrimaryButton type="submit" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send secure setup link"}</PrimaryButton>
            <button type="button" className="recovery-back" onClick={onBack}>Back to sign in</button>
          </form>
        ) : (
          <>
            <div className="recovery-sent"><Mail size={18} /><strong>Setup link sent</strong><span>Open the email on this device to continue securely.</span></div>
            <button type="button" className="minimal-google" disabled={busy} onClick={sendLink}>{busy ? "Sending…" : "Resend setup link"}</button>
            <button type="button" className="recovery-back" onClick={onBack}>Back to sign in</button>
          </>
        )}
      </Card>
    </Shell>
  );
}

function ForgotPassword({ onBack, requestPasswordReset, initialEmail }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Could not send the reset email yet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="minimal-auth-title">Reset your password</h1>
      <p className="recovery-intro">{sent ? "Check your inbox for a secure reset link. Tiny detour, then you’re back." : "Enter the email tied to your FamOS account and we’ll send a secure reset link."}</p>
      <Card className="minimal-auth-card">
        {sent ? (
          <>
            <div className="recovery-sent"><Mail size={18} /><strong>Email sent</strong><span>We sent a recovery link to {email}.</span></div>
            <button className="minimal-google" onClick={onBack}>Back to sign in</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <TextField type="email" label="Email address" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            {error && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}
            <PrimaryButton type="submit" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send reset link"}</PrimaryButton>
            <button type="button" className="recovery-back" onClick={onBack}>Back to sign in</button>
          </form>
        )}
      </Card>
    </Shell>
  );
}

export function ResetPassword() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = password.length >= 6 && password === confirm;

  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err.message || "Could not update password.");
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="minimal-auth-title">Set your FamOS password</h1>
      <p className="recovery-intro">Create your password here, then we’ll take you directly to the family home waiting for you.</p>
      <Card className="minimal-auth-card">
        <form onSubmit={submit}>
          <TextField type={show ? "text" : "password"} label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
          <TextField type={show ? "text" : "password"} label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required />
          <div className="password-actions"><button type="button" onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? "Hide passwords" : "Show passwords"}</button></div>
          {confirm && password !== confirm && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">Those passwords are almost friends, but not quite.</p>}
          {error && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}
          <PrimaryButton type="submit" disabled={busy || !valid}>{busy ? "Saving…" : "Save new password"}</PrimaryButton>
        </form>
      </Card>
    </Shell>
  );
}

export function HouseholdOnboarding() {
  const {
    invitation,
    household,
    householdProfile,
    memberProfile,
    createHousehold,
    saveHouseholdProfile,
    saveMemberProfile,
    acceptInvitation,
    invitePartner,
    skipOnboardingInvites,
    signOut,
    refreshAccount,
    session,
    signInWithGoogle,
    googleProviderToken,
  } = useAuth();
  const [name, setName] = useState("Our family");
  const [inviteMembers, setInviteMembers] = useState([newInviteMember()]);
  const [familySize, setFamilySize] = useState(3);
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(1);
  const [familyDynamic, setFamilyDynamic] = useState("two_parent");
  const [lifeStage, setLifeStage] = useState("school_age");
  const [planningPriorities, setPlanningPriorities] = useState(["calendar", "meals", "groceries"]);
  const [primaryColor, setPrimaryColor] = useState("plum");
  const [profileType, setProfileType] = useState("parent");
  const [calendarPreference, setCalendarPreference] = useState("family");
  const [dietaryRestrictions, setDietaryRestrictions] = useState([]);
  const [avoidIngredients, setAvoidIngredients] = useState("");
  const [mealNotes, setMealNotes] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [groceryImportText, setGroceryImportText] = useState("");
  const [partnerPersonalizationOptIn, setPartnerPersonalizationOptIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0]?.url || "");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [ownerStep, setOwnerStep] = useState(0);
  const [memberStep, setMemberStep] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const profileComplete = Boolean(householdProfile?.completed_at);
  const ownerProfileStep = household?.role === "owner" && !profileComplete;
  const memberProfileStep = household && household.role !== "owner" && !memberProfile?.completedAt;
  const draftKey = household?.id && session?.user?.id ? `family-os:onboarding-draft:${household.id}:${session.user.id}` : "";

  useEffect(() => {
    if (!draftKey) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft) {
        setFamilySize(draft.familySize ?? 3);
        setAdultCount(draft.adultCount ?? 2);
        setChildCount(draft.childCount ?? 1);
        setFamilyDynamic(draft.familyDynamic || "two_parent");
        setLifeStage(draft.lifeStage || "school_age");
        setPlanningPriorities(draft.planningPriorities || ["calendar", "meals", "groceries"]);
        setPrimaryColor(draft.primaryColor || "plum");
        setProfileType(draft.profileType || "parent");
        setCalendarPreference(draft.calendarPreference || "family");
        setDietaryRestrictions(draft.dietaryRestrictions || []);
        setAvoidIngredients(draft.avoidIngredients || "");
        setMealNotes(draft.mealNotes || "");
        setCity(draft.city || "");
        setRegion(draft.region || "");
        setPostalCode(draft.postalCode || "");
        setCountry(draft.country || "");
        setAddress(draft.address || "");
        setLatitude(draft.latitude ?? null);
        setLongitude(draft.longitude ?? null);
        setGroceryImportText(draft.groceryImportText || "");
        setPartnerPersonalizationOptIn(Boolean(draft.partnerPersonalizationOptIn));
        setAvatarUrl(draft.avatarUrl || AVATAR_PRESETS[0]?.url || "");
        if (Array.isArray(draft.inviteMembers) && draft.inviteMembers.length) {
          setInviteMembers(draft.inviteMembers.map((member) => ({ ...newInviteMember(), ...member })));
        } else if (draft.inviteEmails) {
          setInviteMembers(draft.inviteEmails.split(/[\n,;]+/).filter(Boolean).map((email) => ({ ...newInviteMember(), email: email.trim() })));
        }
        setOwnerStep(Math.max(0, Math.min(Number(draft.ownerStep) || 0, 5)));
        setMemberStep(Math.max(0, Math.min(Number(draft.memberStep) || 0, 1)));
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
    setDraftLoaded(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftLoaded) return;
    localStorage.setItem(draftKey, JSON.stringify({
      familySize, adultCount, childCount, familyDynamic, lifeStage, planningPriorities,
      primaryColor, profileType, calendarPreference, dietaryRestrictions, avoidIngredients,
      mealNotes, groceryImportText, partnerPersonalizationOptIn, avatarUrl, inviteMembers,
      city, region, postalCode, country, address, latitude, longitude,
      ownerStep, memberStep,
    }));
  }, [
    draftKey, draftLoaded, familySize, adultCount, childCount, familyDynamic, lifeStage,
    planningPriorities, primaryColor, profileType, calendarPreference, dietaryRestrictions,
    avoidIngredients, mealNotes, groceryImportText, partnerPersonalizationOptIn, avatarUrl,
    inviteMembers, city, region, postalCode, country, address, latitude, longitude, ownerStep, memberStep,
  ]);

  const title = useMemo(() => {
    if (invitation && !household) return "Come on in";
    if (!household) return "What should we call home?";
    if (ownerProfileStep) return ["Who’s at home?", "Where is home? (optional)", "What matters most?", "Make meals easier", "Bring your grocery list", "One last thing"][ownerStep];
    if (memberProfileStep) return ["How should we set you up?", "Choose your calendar view"][memberStep];
    return "Invite your people";
  }, [household, invitation, memberProfileStep, memberStep, ownerProfileStep, ownerStep]);

  const intro = useMemo(() => {
    if (invitation && !household) return `You’ve been invited to ${invitation.households?.name}. Join the shared home for calendars, lists, tasks, meals, and chat.`;
    if (!household) return "Create the private home space everyone will share. Cozy, but organized.";
    if (ownerProfileStep) return [
      "Start with the basics. You can change these later in Settings.",
      "Optional. Choose a Google Maps suggestion to add local weather and weather-sensitive event alerts, or skip this for now.",
      "Pick the areas you want FamOS to focus on first.",
      "Optional details that make meal ideas more useful.",
      "Optional. Paste what you already buy and we’ll organize it.",
      "Connect your calendar now or come back to it anytime.",
    ][ownerStep];
    if (memberProfileStep) return [
      `You’re joining ${household.name}. First, choose your profile type.`,
      "Choose what you want to see first. You can always switch views later.",
    ][memberStep];
    return `Invite people to ${household.name} now, or skip and add them later from Settings.`;
  }, [household, invitation, memberProfileStep, memberStep, ownerProfileStep, ownerStep]);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message || "Something tripped. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const togglePriority = (priority) => {
    setPlanningPriorities((current) => current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority]);
  };

  const toggleRestriction = (restriction) => {
    setDietaryRestrictions((current) => current.includes(restriction) ? current.filter((item) => item !== restriction) : [...current, restriction]);
  };

  const saveOwnerProfile = () => run(async () => {
    if (adultCount + childCount !== familySize) {
      throw new Error("Family members should equal the number of adults plus kids.");
    }
    await saveHouseholdProfile({
      familySize,
      adultCount,
      childCount,
      familyDynamic,
      lifeStage,
      planningPriorities,
      primaryColor,
      profileType,
      dietaryRestrictions,
      avoidIngredients,
      mealNotes,
      city,
      region,
      postalCode,
      country,
      address,
      latitude,
      longitude,
      groceryImportText,
      partnerPersonalizationOptIn,
      avatarUrl,
    });
    if (draftKey) localStorage.removeItem(draftKey);
  });

  const saveMember = () => run(async () => {
    await saveMemberProfile({ profileType, calendarPreference, avatarUrl });
    if (draftKey) localStorage.removeItem(draftKey);
  });

  return (
    <Shell wide>
      <h1 className="minimal-auth-title">{title}</h1>
      <p className="recovery-intro">{intro}</p>
      <Card className="p-5 onboarding-card">
        {invitation && !household ? (
          <InvitationStep invitation={invitation} busy={busy} onAccept={() => run(acceptInvitation)} />
        ) : !household ? (
          <HouseholdNameStep name={name} setName={setName} busy={busy} onContinue={() => run(() => createHousehold(name))} />
        ) : ownerProfileStep ? (
          <OwnerProfileStep
            familySize={familySize}
            setFamilySize={setFamilySize}
            adultCount={adultCount}
            setAdultCount={setAdultCount}
            childCount={childCount}
            setChildCount={setChildCount}
            profileType={profileType}
            setProfileType={setProfileType}
            familyDynamic={familyDynamic}
            setFamilyDynamic={setFamilyDynamic}
            lifeStage={lifeStage}
            setLifeStage={setLifeStage}
            city={city}
            setCity={setCity}
            region={region}
            setRegion={setRegion}
            postalCode={postalCode}
            setPostalCode={setPostalCode}
            country={country}
            setCountry={setCountry}
            address={address}
            setAddress={setAddress}
            latitude={latitude}
            setLatitude={setLatitude}
            longitude={longitude}
            setLongitude={setLongitude}
            planningPriorities={planningPriorities}
            togglePriority={togglePriority}
            primaryColor={primaryColor}
            setPrimaryColor={setPrimaryColor}
            dietaryRestrictions={dietaryRestrictions}
            toggleRestriction={toggleRestriction}
            avoidIngredients={avoidIngredients}
            setAvoidIngredients={setAvoidIngredients}
            mealNotes={mealNotes}
            setMealNotes={setMealNotes}
            groceryImportText={groceryImportText}
            setGroceryImportText={setGroceryImportText}
            partnerPersonalizationOptIn={partnerPersonalizationOptIn}
            setPartnerPersonalizationOptIn={setPartnerPersonalizationOptIn}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            avatarStatus={avatarStatus}
            setAvatarStatus={setAvatarStatus}
            signInWithGoogle={signInWithGoogle}
            googleProviderToken={googleProviderToken}
            busy={busy}
            run={run}
            onSave={saveOwnerProfile}
            step={ownerStep}
            setStep={setOwnerStep}
          />
        ) : memberProfileStep ? (
          <MemberProfileStep
            profileType={profileType}
            setProfileType={setProfileType}
            calendarPreference={calendarPreference}
            setCalendarPreference={setCalendarPreference}
            signInWithGoogle={signInWithGoogle}
            googleProviderToken={googleProviderToken}
            busy={busy}
            run={run}
            onSave={saveMember}
            step={memberStep}
            setStep={setMemberStep}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            avatarStatus={avatarStatus}
            setAvatarStatus={setAvatarStatus}
          />
        ) : (
          <InviteStep inviteMembers={inviteMembers} setInviteMembers={setInviteMembers} busy={busy} invitePartner={invitePartner} run={run} skipOnboardingInvites={skipOnboardingInvites} />
        )}
        {error && <div className="onboarding-recovery"><p>{error}</p>{/already belong to a household/i.test(error) && <button disabled={busy} onClick={() => run(() => refreshAccount(session))}>Open my existing household</button>}</div>}
      </Card>
      <button onClick={signOut} className="w-full text-center text-[12.5px] text-[var(--color-ink-soft)] mt-5">Sign out</button>
    </Shell>
  );
}

function InvitationStep({ invitation, busy, onAccept }) {
  return (
    <>
      <div className="invitation-recognized">
        <Check size={18} />
        <div><strong>We recognized your email</strong><span>You already have a pending invitation.</span></div>
      </div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">You’re invited to</p>
      <h2 className="font-semibold text-[22px] mt-1 mb-1">{invitation.households?.name}</h2>
      <p className="text-[13px] text-[var(--color-ink-soft)] mb-5">Confirm to join this home and share its calendar, chat, tasks, meals, and grocery lists. Your account will not create a separate household.</p>
      <PrimaryButton disabled={busy} onClick={onAccept}>{busy ? "Joining your home…" : `Join ${invitation.households?.name || "this home"}`}</PrimaryButton>
    </>
  );
}

function HouseholdNameStep({ name, setName, busy, onContinue }) {
  return (
    <>
      <TextField label="Household name" placeholder="e.g. The Miller Family" value={name} onChange={(e) => setName(e.target.value)} required />
      <PrimaryButton disabled={busy || !name.trim()} onClick={onContinue}>{busy ? "Creating…" : "Continue"}</PrimaryButton>
    </>
  );
}

function OwnerProfileStep(props) {
  const restrictions = [
    ["Vegetarian", Leaf], ["Vegan", Salad], ["Gluten-free", WheatOff], ["Dairy-free", ChefHat],
    ["Nut-free", HeartHandshake], ["Shellfish-free", ShieldCheck], ["Low sugar", Sparkles],
  ];
  const steps = ["Household", "Address", "Priorities", "Food", "Groceries", "Connect"];
  const next = () => {
    if (props.step === 0 && props.adultCount + props.childCount !== props.familySize) return;
    props.setStep((step) => Math.min(step + 1, steps.length - 1));
  };
  const basicsValid = props.adultCount + props.childCount === props.familySize;

  return (
    <div className="guided-onboarding">
      <OnboardingProgress steps={steps} current={props.step} />
      <div className="guided-onboarding-panel">
        {props.step === 0 && <>
          <div className="onboarding-grid">
            <NumberField label="Family members" value={props.familySize} setValue={props.setFamilySize} min={1} />
            <NumberField label="Adults" value={props.adultCount} setValue={props.setAdultCount} min={0} />
            <NumberField label="Kids" value={props.childCount} setValue={props.setChildCount} min={0} />
          </div>
          {!basicsValid && <p className="onboarding-inline-note">Adults plus kids should equal {props.familySize} family members.</p>}
          <OnboardingChoiceGroup icon={<UsersRound size={15} />} label="Your role" value={props.profileType} onChange={props.setProfileType} options={[["parent", "Parent / guardian", UserRound], ["child", "Child", Baby]]} />
          <OnboardingChoiceGroup icon={<House size={15} />} label="Family dynamic" value={props.familyDynamic} onChange={props.setFamilyDynamic} options={[["two_parent", "Two-parent home", UsersRound], ["single_parent", "Single parent", UserRound], ["coparenting", "Co-parenting", HeartHandshake], ["blended", "Blended family", UsersRound], ["multigenerational", "Multigenerational", House], ["chosen_family", "Chosen family", Sparkles]]} />
          <OnboardingChoiceGroup icon={<Sparkles size={15} />} label="Life stage" value={props.lifeStage} onChange={props.setLifeStage} options={[["pregnant", "Pregnant", HeartHandshake], ["newborn", "Newborn", Baby], ["toddler", "Toddler", Baby], ["school_age", "School age", BriefcaseBusiness], ["teens", "Teenagers", UsersRound], ["adult_family", "Adult family", House]]} />
        </>}

        {props.step === 1 && <>
          <AddressAutocomplete
            label="Home address (optional)"
            value={props.address}
            placeholder="Start typing and choose an address"
            onChange={(place) => {
              props.setAddress(place.address ?? props.address);
              if (place.city !== undefined) props.setCity(place.city);
              if (place.region !== undefined) props.setRegion(place.region);
              if (place.postalCode !== undefined) props.setPostalCode(place.postalCode);
              if (place.country !== undefined) props.setCountry(place.country);
              if (place.latitude !== undefined) props.setLatitude(place.latitude);
              if (place.longitude !== undefined) props.setLongitude(place.longitude);
            }}
          />
          <div className="onboarding-address-preview" aria-live="polite">
            {[
              ["Address", props.address],
              ["City", props.city],
              ["Province / state", props.region],
              ["Postal code", props.postalCode],
              ["Country", props.country],
            ].map(([label, value]) => (
              <div key={label} className={label === "Address" ? "wide" : ""}>
                <span>{label}</span>
                <strong>{value || "Filled automatically"}</strong>
              </div>
            ))}
          </div>
          <p className="onboarding-location-note">
            Your home address helps FamOS personalize local weather, your household experience, and future location-based product updates. It is optional, shared only with your household, and can be added or changed later in Settings.
          </p>
        </>}

        {props.step === 2 && <div className="onboarding-choice-group onboarding-priority-grid">
          <span><Sparkles size={15} /> Choose all that apply</span>
          <div>{[["calendar", "Schedules", CalendarDays], ["meals", "Meal planning", ChefHat], ["groceries", "Groceries", ShoppingCart], ["tasks", "Chores & tasks", CheckSquare], ["finance", "Budgeting", WalletCards], ["chat", "Family chat", MessageCircle]].map(([value, label, Icon]) => <button type="button" key={value} className={props.planningPriorities.includes(value) ? "selected" : ""} onClick={() => props.togglePriority(value)}><Icon size={16} />{label}{props.planningPriorities.includes(value) && <Check className="onboarding-pill-check" size={13} />}</button>)}</div>
        </div>}

        {props.step === 3 && <>
          <div className="onboarding-choice-group">
            <span><ChefHat size={15} /> Dietary preferences</span>
            <div>{restrictions.map(([restriction, Icon]) => <button type="button" key={restriction} className={props.dietaryRestrictions.includes(restriction) ? "selected" : ""} onClick={() => props.toggleRestriction(restriction)}><Icon size={15} />{restriction}</button>)}</div>
          </div>
          <div className="onboarding-grid onboarding-grid-two">
            <label className="onboarding-field"><span>Avoid ingredients</span><textarea placeholder="e.g. peanuts, cilantro" value={props.avoidIngredients} onChange={(e) => props.setAvoidIngredients(e.target.value)} /></label>
            <label className="onboarding-field"><span>Meal notes</span><textarea placeholder="e.g. quick school-night dinners" value={props.mealNotes} onChange={(e) => props.setMealNotes(e.target.value)} /></label>
          </div>
        </>}

        {props.step === 4 && <label className="onboarding-field onboarding-full onboarding-grocery-import"><span><ShoppingCart size={15} /> Paste your current grocery list</span><textarea placeholder={"Milk\nEggs\nBananas x6\nGreek yogurt"} value={props.groceryImportText} onChange={(e) => props.setGroceryImportText(e.target.value)} /><small>One item per line works best. We’ll add them to Groceries and remember them as staples.</small></label>}

        {props.step === 5 && <>
          <GoogleCalendarStep signInWithGoogle={props.signInWithGoogle} googleProviderToken={props.googleProviderToken} busy={props.busy} run={props.run} />
          <div className="onboarding-choice-group">
            <span><Palette size={15} /> Your colour</span>
            <div className="onboarding-colors">
              {FAMILY_COLORS.map((color) => <button type="button" key={color.id} className={props.primaryColor === color.id ? "selected" : ""} onClick={() => props.setPrimaryColor(color.id)} style={{ backgroundColor: color.value }} aria-label={color.label} />)}
            </div>
          </div>
          <AvatarPicker avatarUrl={props.avatarUrl} setAvatarUrl={props.setAvatarUrl} status={props.avatarStatus} setStatus={props.setAvatarStatus} />
          <label className="partner-consent">
            <input type="checkbox" checked={props.partnerPersonalizationOptIn} onChange={(event) => props.setPartnerPersonalizationOptIn(event.target.checked)} />
            <span><strong>Personalize suggestions for my household</strong><small>Optional. Uses the preferences you entered to improve meal and grocery suggestions.</small></span>
          </label>
        </>}
      </div>
      <OnboardingActions
        step={props.step}
        lastStep={steps.length - 1}
        busy={props.busy}
        nextDisabled={props.step === 0 && !basicsValid}
        nextLabel={
          (props.step === 1 && !props.address.trim())
          || (props.step === 3 && !props.dietaryRestrictions.length && !props.avoidIngredients.trim() && !props.mealNotes.trim())
          || (props.step === 4 && !props.groceryImportText.trim())
            ? "Skip for now"
            : undefined
        }
        onBack={() => props.setStep((step) => Math.max(0, step - 1))}
        onNext={next}
        onFinish={props.onSave}
        finishLabel="Finish setup"
      />
    </div>
  );
}

function MemberProfileStep({ profileType, setProfileType, calendarPreference, setCalendarPreference, signInWithGoogle, googleProviderToken, busy, run, onSave, step, setStep, avatarUrl, setAvatarUrl, avatarStatus, setAvatarStatus }) {
  const steps = ["Profile", "Calendar"];
  return (
    <div className="guided-onboarding">
      <OnboardingProgress steps={steps} current={step} />
      <div className="guided-onboarding-panel">
        {step === 0 && <>
          <OnboardingChoiceGroup icon={<UsersRound size={15} />} label="Profile type" value={profileType} onChange={setProfileType} options={[["parent", "Parent / guardian", UserRound], ["child", "Child", Baby]]} />
          <AvatarPicker avatarUrl={avatarUrl} setAvatarUrl={setAvatarUrl} status={avatarStatus} setStatus={setAvatarStatus} />
        </>}
        {step === 1 && <>
          <OnboardingChoiceGroup icon={<CalendarDays size={15} />} label="Default calendar view" value={calendarPreference} onChange={setCalendarPreference} options={[["family", "Shared family calendar", UsersRound], ["personal", "My calendar first", UserRound]]} />
          <GoogleCalendarStep signInWithGoogle={signInWithGoogle} googleProviderToken={googleProviderToken} busy={busy} run={run} />
        </>}
      </div>
      <OnboardingActions step={step} lastStep={1} busy={busy} onBack={() => setStep(0)} onNext={() => setStep(1)} onFinish={onSave} finishLabel="Enter shared home" />
    </div>
  );
}

function OnboardingProgress({ steps, current }) {
  return (
    <div className="onboarding-progress" aria-label={`Step ${current + 1} of ${steps.length}`}>
      <div className="onboarding-progress-copy"><span>Step {current + 1} of {steps.length}</span><strong>{steps[current]}</strong></div>
      <div className="onboarding-progress-track"><i style={{ width: `${((current + 1) / steps.length) * 100}%` }} /></div>
      <div className="onboarding-progress-labels">{steps.map((step, index) => <span key={step} className={index <= current ? "active" : ""}>{step}</span>)}</div>
    </div>
  );
}

function OnboardingActions({ step, lastStep, busy, nextDisabled, nextLabel, onBack, onNext, onFinish, finishLabel }) {
  const isLast = step === lastStep;
  return (
    <div className="onboarding-actions">
      {step > 0 ? <SecondaryButton type="button" disabled={busy} onClick={onBack}><ChevronLeft size={16} /> Back</SecondaryButton> : <span />}
      <PrimaryButton disabled={busy || nextDisabled} onClick={isLast ? onFinish : onNext}>
        {busy ? "Saving…" : isLast ? finishLabel : nextLabel || "Continue"}
      </PrimaryButton>
    </div>
  );
}

function InviteStep({ inviteMembers, setInviteMembers, busy, invitePartner, run, skipOnboardingInvites }) {
  const updateInvite = (index, field, value) => {
    setInviteMembers((members) => members.map((member, memberIndex) => memberIndex === index ? { ...member, [field]: value } : member));
  };

  const removeInvite = (index) => {
    setInviteMembers((members) => members.length === 1 ? [newInviteMember()] : members.filter((_, memberIndex) => memberIndex !== index));
  };

  const sendInvites = () => run(async () => {
    const invitations = inviteMembers
      .map((member) => ({ ...member, name: member.name.trim(), email: member.email.trim().toLowerCase(), phone: normalizePhoneE164(member.phone) }))
      .filter((member) => member.name || member.email || member.phone);
    if (!invitations.length) throw new Error("Add at least one family member or skip this step.");
    const invalidPhone = inviteMembers.find((member) => member.phone.trim() && !isValidPhoneNumber(member.phone));
    if (invalidPhone) throw new Error(`Add a valid mobile number with country code for ${invalidPhone.name || "this family member"}.`);
    const incomplete = invitations.find((member) => !member.name || !member.email || !member.phone);
    if (incomplete) throw new Error("Add a name, email address, and mobile number for each family member.");
    const invalidEmail = invitations.find((member) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email));
    if (invalidEmail) throw new Error(`Check the email address “${invalidEmail.email}” and try again.`);
    const missingConsent = invitations.find((member) => !member.smsConsent);
    if (missingConsent) throw new Error(`Confirm SMS invitation consent for ${missingConsent.name}.`);
    const duplicateEmail = invitations.find((member, index) => invitations.findIndex((candidate) => candidate.email === member.email) !== index);
    if (duplicateEmail) throw new Error(`${duplicateEmail.email} is listed more than once.`);
    const results = [];
    for (const member of invitations) {
      results.push(await invitePartner(member.email, member.phone, member.name));
    }
    const failed = results.find((result) => !result?.sent && !result?.pending);
    if (failed) throw new Error(failed.message || "The invitation was saved, but delivery could not be confirmed.");
    skipOnboardingInvites();
  });

  return (
    <>
      <div className="onboarding-invite-list">
        {inviteMembers.map((member, index) => (
          <section className="onboarding-invite-person" key={index}>
            <div className="onboarding-invite-person-head">
              <strong>Family member {index + 1}</strong>
              <button type="button" onClick={() => removeInvite(index)} aria-label={`Remove family member ${index + 1}`}><Trash2 size={15} /></button>
            </div>
            <div className="onboarding-invite-fields">
              <TextField type="text" label="Name" placeholder="e.g. Sam Lee" value={member.name} onChange={(event) => updateInvite(index, "name", event.target.value)} autoComplete="name" />
              <TextField type="email" label="Email" placeholder="sam@example.com" value={member.email} onChange={(event) => updateInvite(index, "email", event.target.value)} autoComplete="email" />
              <div className="invite-phone-field">
                <TextField type="tel" label="Mobile number" placeholder="+1 (416) 555-0123" value={member.phone} onChange={(event) => updateInvite(index, "phone", formatPhoneInput(event.target.value))} autoComplete="tel" inputMode="tel" aria-invalid={Boolean(member.phone && !isValidPhoneNumber(member.phone))} />
                {member.phone && !isValidPhoneNumber(member.phone) && <small>Enter 10 digits, or include + and the country code.</small>}
              </div>
            </div>
            <label className="partner-consent onboarding-invite-consent">
              <input type="checkbox" checked={member.smsConsent} onChange={(event) => updateInvite(index, "smsConsent", event.target.checked)} />
              <span><strong>SMS invitation consent confirmed</strong><small>This person agreed to receive one FamOS invitation text. Standard message rates may apply.</small></span>
            </label>
          </section>
        ))}
      </div>
      <button type="button" className="onboarding-add-invite" onClick={() => setInviteMembers((members) => [...members, newInviteMember()])}><Plus size={16} /> Add another family member</button>
      <p className="onboarding-hint">Each person receives a secure email invitation and a one-time SMS invitation.</p>
      <PrimaryButton disabled={busy || !inviteMembers.some((member) => member.name.trim() || member.email.trim() || member.phone.trim())} onClick={sendInvites}>{busy ? "Sending invites…" : "Send invites & continue"}</PrimaryButton>
      <SecondaryButton type="button" className="mt-2 onboarding-skip-button" disabled={busy} onClick={skipOnboardingInvites}>Skip for now</SecondaryButton>
    </>
  );
}

function NumberField({ label, value, setValue, min }) {
  return <label><span>{label}</span><input type="number" min={min} max="30" value={value} onChange={(event) => setValue(Number(event.target.value) || min)} /></label>;
}

function GoogleCalendarStep({ signInWithGoogle, googleProviderToken, busy, run }) {
  return (
    <div className={`onboarding-calendar-card ${googleProviderToken ? "is-connected" : ""}`}>
      <div className="onboarding-calendar-icon"><CalendarDays size={20} /></div>
      <div>
        <strong>{googleProviderToken ? <><Check size={16} /> Google Calendar connected</> : "Connect Google Calendar"}</strong>
        <small>{googleProviderToken ? "Your progress was saved. Continue setup when you’re ready." : "Optional. Choose which calendars to import after your account is set up."}</small>
      </div>
      <SecondaryButton type="button" className="onboarding-connect-button" disabled={busy || Boolean(googleProviderToken)} onClick={() => run(signInWithGoogle)}>{googleProviderToken ? "Connected" : "Connect Google"}</SecondaryButton>
    </div>
  );
}

function AvatarPicker({ avatarUrl, setAvatarUrl, status, setStatus }) {
  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUrl(await resizeAvatarImage(file));
      setStatus("Photo ready to use.");
    } catch {
      setStatus("Could not read that image. Try another photo.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="onboarding-avatar-picker">
      <div className="onboarding-avatar-heading">
        <span><UserRound size={15} /> Choose your avatar</span>
        <label><input type="file" accept="image/*" onChange={uploadAvatar} /><ImagePlus size={15} /> Upload photo</label>
      </div>
      <div className="onboarding-avatar-grid">
        {AVATAR_PRESETS.slice(0, 10).map((avatar) => (
          <button key={avatar.id} type="button" className={avatarUrl === avatar.url ? "selected" : ""} onClick={() => { setAvatarUrl(avatar.url); setStatus(""); }} aria-label={`Use ${avatar.label} avatar`}>
            <img src={avatar.url} alt="" />
          </button>
        ))}
        {avatarUrl?.startsWith("data:") && <button type="button" className="selected custom"><img src={avatarUrl} alt="Your uploaded avatar" /></button>}
      </div>
      {status && <p className="avatar-status">{status}</p>}
    </div>
  );
}

function OnboardingChoiceGroup({ icon, label, value, onChange, options }) {
  return (
    <div className="onboarding-choice-group">
      <span>{icon} {label}</span>
      <div>{options.map(([optionValue, optionLabel, OptionIcon]) => <button type="button" key={optionValue} className={value === optionValue ? "selected" : ""} onClick={() => onChange(optionValue)}>{OptionIcon && <OptionIcon size={15} />}{optionLabel}</button>)}</div>
    </div>
  );
}
