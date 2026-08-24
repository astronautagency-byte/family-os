import { useEffect, useMemo, useState } from "react";
import { Baby, Bell, BellRing, BriefcaseBusiness, CalendarDays, Check, CheckSquare, ChefHat, ChevronLeft, Eye, EyeOff, HeartHandshake, House, ImagePlus, Leaf, LoaderCircle, LockKeyhole, Mail, MessageCircle, MilkOff, Palette, Phone, Plus, Salad, Send, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Trash2, UserRound, UsersRound, WalletCards, WheatOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, DateField, PrimaryButton, ProgressBar, SecondaryButton, TextField } from "../components/ui";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import { ColorSchemePicker } from "../components/ColorSchemePicker";
// Namespace import (vs. named `passwordError`) makes every call a property
// access — esbuild/Terser can no longer minify `passwordError` and a local
// destructured `error` to the identical short identifier `n`, which was the
// TDZ that broke new-password setup.
import * as PasswordStrength from "../utils/passwordStrength";
import { supabase } from "../lib/supabase";
import { finishDesktopAuthHandoff } from "../lib/desktopAuth";
import { PRICING_PLAN, formatMoney } from "../data/pricingPlan";

const VAPID_PUBLIC_KEY = "BK4WksXI5RRZqDhurNH8v2VbinrSKrBLzOA6xni__siwCbKjhtJ1T0N3GOSVKKQPNAnENCacYtdlLW553fadxHQ";

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
import AddressAutocomplete from "../components/AddressAutocomplete";
import { formatPhoneInput, isValidPhoneNumber, normalizePhoneE164 } from "../utils/phone";
import { APP_COLOR_SCHEMES } from "../data/appColorSchemes";
import { sendWelcomeEmail } from "../lib/onboardingEmails";

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
  const { signIn, signUp, requestPasswordReset, requestInvitePasswordCode, completeInvitePasswordSetup, error } = useAuth();
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
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(openedInvitation);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || PasswordStrength.passwordError(password) || (creating && !displayName.trim())) return;
    setBusy(true);
    setLocalError("");
    setNotice("");
    setNeedsPasswordSetup(false);
    try {
      if (creating) {
        const data = await signUp(email, password, displayName);
        if (data.session) await finishDesktopAuthHandoff(data.session);
        else setNotice("Account created. Check your email, then sign in.");
      } else {
        const data = await signIn(email, password);
        if (data?.session) await finishDesktopAuthHandoff(data.session);
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
        completeSetup={completeInvitePasswordSetup}
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
          <TextField type={showPassword ? "text" : "password"} label="Password" placeholder="8+ characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={creating ? "new-password" : "current-password"} minLength={8} required />
          <div className="password-actions">
            <button type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />} {showPassword ? "Hide password" : "Show password"}
            </button>
            {!creating && <button type="button" onClick={() => setForgot(true)}>Forgot?</button>}
          </div>
          {(localError || error) && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{localError || error}</p>}
          {notice && <p className="text-[12.5px] text-[var(--color-good)] mb-3">{notice}</p>}
          {creating && <PasswordStrengthMeter value={password} />}
          <PrimaryButton type="submit" className={creating ? "btn-create" : ""} disabled={busy || !email.trim() || !!PasswordStrength.passwordError(password) || (creating && !displayName.trim())}>
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

function InvitedPasswordSetup({ initialEmail, requestCode, completeSetup, onBack }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email.trim() || PasswordStrength.passwordError(password) || password !== confirm) return;
    setBusy(true);
    setError("");
    try {
      await requestCode(email);
      setCodeSent(true);
    } catch (err) {
      setError(err.message || "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  };

  const createPassword = async (event) => {
    event.preventDefault();
    if (!code.trim() || PasswordStrength.passwordError(password) || password !== confirm) return;
    setBusy(true);
    setError("");
    try {
      await completeSetup(email, code, password);
    } catch (err) {
      setError(err.message || "That code could not be verified.");
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="minimal-auth-title">Create your password</h1>
      <p className="recovery-intro">
        {codeSent
          ? `Enter the verification code sent to ${email}, then join your family.`
          : "Choose your password here. We’ll email a one-time code to verify the invited address—no reset link."}
      </p>
      <Card className="minimal-auth-card">
        <form onSubmit={createPassword}>
          <TextField type="email" label="Invited email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={codeSent} />
          <TextField type={showPassword ? "text" : "password"} label="Create password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          <TextField type={showPassword ? "text" : "password"} label="Confirm password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required />
          <div className="password-actions">
            <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />} {showPassword ? "Hide passwords" : "Show passwords"}</button>
          </div>
          {confirm && password !== confirm && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">Those passwords do not match yet.</p>}
          {codeSent && <TextField label="6-digit verification code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />}
          {error && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}
          {codeSent ? (
            <>
              <PasswordStrengthMeter value={password} />
          <PrimaryButton type="submit" disabled={busy || code.length !== 6 || !!PasswordStrength.passwordError(password) || password !== confirm}>{busy ? "Creating password…" : "Create password & join"}</PrimaryButton>
              <button type="button" className="minimal-google" disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send a new code"}</button>
            </>
          ) : (
            <PrimaryButton type="button" onClick={sendCode} disabled={busy || !email.trim() || !!PasswordStrength.passwordError(password) || password !== confirm}>{busy ? "Sending code…" : "Email my verification code"}</PrimaryButton>
          )}
          <button type="button" className="recovery-back" onClick={onBack}>Back to sign in</button>
        </form>
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
  const valid = !PasswordStrength.passwordError(password) && password === confirm;

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
          <TextField type={show ? "text" : "password"} label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
          <TextField type={show ? "text" : "password"} label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
          <div className="password-actions"><button type="button" onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? "Hide passwords" : "Show passwords"}</button></div>
          {confirm && password !== confirm && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">Those passwords are almost friends, but not quite.</p>}
          <PasswordStrengthMeter value={password} />
          {error && <p className="text-[12.5px] text-[var(--color-warn)] mb-3">{error}</p>}
          <PrimaryButton type="submit" disabled={busy || !valid}>{busy ? "Saving…" : "Save new password"}</PrimaryButton>
        </form>
      </Card>
    </Shell>
  );
}

export function HouseholdOnboarding({ colorScheme = "famos", onColorSchemeChange = () => {} }) {
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
    markOnboardingComplete,
    signOut,
    refreshAccount,
    session,
    signInWithGoogle,
    googleProviderToken,
    memberDeliveryChannel,
    updateDeliveryChannel,
  } = useAuth();
  const [name, setName] = useState("");
  const [inviteMembers, setInviteMembers] = useState([newInviteMember()]);
  const [onboardingFamilyMembers, setOnboardingFamilyMembers] = useState([{ firstName: "", relationship: "", birthday: "" }]);
  const [familyInterests, setFamilyInterests] = useState([]);
  const [scheduleSources, setScheduleSources] = useState([]);
  const [scheduleFeedUrl, setScheduleFeedUrl] = useState("");
  const [familySize, setFamilySize] = useState(3);
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(1);
  const [familyDynamic, setFamilyDynamic] = useState("two_parent");
  const [lifeStage, setLifeStage] = useState("school_age");
  const [planningPriorities, setPlanningPriorities] = useState(["calendar", "meals", "groceries"]);
  const [primaryColor, setPrimaryColor] = useState("plum");
  const [profileType, setProfileType] = useState("parent");
  const [calendarPreference, setCalendarPreference] = useState("family");
  const [age, setAge] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
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
  const [taskImportText, setTaskImportText] = useState("");
  const [partnerPersonalizationOptIn, setPartnerPersonalizationOptIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [ownerStep, setOwnerStep] = useState(0);
  const [memberStep, setMemberStep] = useState(0);
  const [trialConfirmation, setTrialConfirmation] = useState("");
  const [notificationsSkipped, setNotificationsSkipped] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoResult, setPromoResult] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const profileComplete = Boolean(householdProfile?.completed_at);
  const ownerProfileStep = household?.role === "owner" && !profileComplete;
  const memberProfileStep = household && !ownerProfileStep && !memberProfile?.completedAt;
  const draftKey = household?.id && session?.user?.id ? `family-os:onboarding-draft:v2:${household.id}:${session.user.id}` : "";

  useEffect(() => {
    if (!draftKey) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft) {
        setName(draft.name || "");
        setOnboardingFamilyMembers(Array.isArray(draft.onboardingFamilyMembers) && draft.onboardingFamilyMembers.length ? draft.onboardingFamilyMembers : [{ firstName: "", relationship: "", birthday: "" }]);
        setFamilyInterests(draft.familyInterests || []);
        setScheduleSources(draft.scheduleSources || []);
        setScheduleFeedUrl(draft.scheduleFeedUrl || "");
        setFamilySize(draft.familySize ?? 3);
        setAdultCount(draft.adultCount ?? 2);
        setChildCount(draft.childCount ?? 1);
        setFamilyDynamic(draft.familyDynamic || "two_parent");
        setLifeStage(draft.lifeStage || "school_age");
        setPlanningPriorities(draft.planningPriorities || ["calendar", "meals", "groceries"]);
        setPrimaryColor(draft.primaryColor || "plum");
        setProfileType(draft.profileType || "parent");
        setCalendarPreference(draft.calendarPreference || "family");
        setAge(draft.age ?? "");
        setDateOfBirth(draft.dateOfBirth || "");
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
        setTaskImportText(draft.taskImportText || "");
        setPartnerPersonalizationOptIn(Boolean(draft.partnerPersonalizationOptIn));
        setAvatarUrl(draft.avatarUrl || "");
        if (Array.isArray(draft.inviteMembers) && draft.inviteMembers.length) {
          setInviteMembers(draft.inviteMembers.map((member) => ({ ...newInviteMember(), ...member })));
        } else if (draft.inviteEmails) {
          setInviteMembers(draft.inviteEmails.split(/[\n,;]+/).filter(Boolean).map((email) => ({ ...newInviteMember(), email: email.trim() })));
        }
        setNotificationsSkipped(Boolean(draft.notificationsSkipped));
        setOwnerStep(Math.max(0, Math.min(Number(draft.ownerStep) || 0, 5)));
        setMemberStep(Math.max(0, Math.min(Number(draft.memberStep) || 0, 3)));
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
    setDraftLoaded(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftLoaded) return;
    localStorage.setItem(draftKey, JSON.stringify({
      name, onboardingFamilyMembers, familyInterests, scheduleSources, scheduleFeedUrl,
      familySize, adultCount, childCount, familyDynamic, lifeStage, planningPriorities,
      primaryColor, profileType, calendarPreference, age, dateOfBirth, dietaryRestrictions, avoidIngredients,
      mealNotes, groceryImportText, taskImportText, partnerPersonalizationOptIn, avatarUrl, inviteMembers,
      city, region, postalCode, country, address, latitude, longitude,
      ownerStep, memberStep, notificationsSkipped,
    }));
  }, [
    draftKey, draftLoaded, name, onboardingFamilyMembers, familyInterests, scheduleSources, scheduleFeedUrl,
    familySize, adultCount, childCount, familyDynamic, lifeStage,
    planningPriorities, primaryColor, profileType, calendarPreference, age, dateOfBirth, dietaryRestrictions,
    avoidIngredients, mealNotes, groceryImportText, taskImportText, partnerPersonalizationOptIn, avatarUrl,
    inviteMembers, city, region, postalCode, country, address, latitude, longitude, ownerStep, memberStep, notificationsSkipped,
  ]);

  const title = useMemo(() => {
    if (invitation && !household) return "Come on in";
    if (!household) return "Create your family";
    if (memberProfileStep) return ["Tell us about you", "Food preferences", "Add your calendar", "Make it yours"][memberStep];
    if (ownerProfileStep) return ["Who’s at home?", "Where is home?", "Connect your calendar", "Bring your task lists", "Set food preferences", "Bring your shopping list", "Choose your look", "Start your trial"][ownerStep];
    return "Invite your people";
  }, [household, invitation, memberProfileStep, memberStep, ownerProfileStep, ownerStep]);

  const intro = useMemo(() => {
    if (invitation && !household) return `You’ve been invited to ${invitation.households?.name}. Join the shared home for calendars, lists, tasks, meals, and chat.`;
    if (!household) return "Set up the private home your household will share.";
    if (memberProfileStep) return [
      "Everything here is optional. These details help FamOS tailor schedules, meals, and suggestions to you.",
      "Share only what is useful. Dietary preferences help personalize meal ideas and shopping suggestions.",
      "Connect a calendar if you want your schedule in FamOS. You can always do this later in Settings.",
      "Choose the look you like. It only changes FamOS for you, and everything here is optional.",
    ][memberStep];
    if (ownerProfileStep) return [
      "Add the people you plan around. You can edit this later.",
      "Choose the activities that keep your household moving.",
      "Connect calendars now, or add things yourself as you go.",
      "Here’s a useful starting point for your family’s week.",
      "Unlock every Pro feature for 30 days. Your family can always stay on Core.",
    ][ownerStep];
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

  const finishRevisedOnboarding = () => {
    skipOnboardingInvites();
    window.location.assign("/");
  };

  const saveOwnerProfile = () => run(async () => {
    if (!onboardingFamilyMembers.some((member) => member.firstName.trim())) {
      throw new Error("Add at least one family member, or add yourself to continue.");
    }
    await saveHouseholdProfile({
      familySize: Math.max(1, onboardingFamilyMembers.length + 1),
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
      onboardingFamily: onboardingFamilyMembers.filter((member) => member.firstName.trim()),
      onboardingInterests: familyInterests,
      onboardingScheduleSources: scheduleSources,
      scheduleFeedUrl,
      groceryImportText,
      taskImportText,
      partnerPersonalizationOptIn,
      avatarUrl,
    });
    if (draftKey) localStorage.removeItem(draftKey);
    // Send invites to family members with contact info (background, non-blocking)
    const membersWithContact = onboardingFamilyMembers.filter((m) => m.firstName.trim() && (m.email?.trim() || m.phone?.trim()));
    if (membersWithContact.length && household?.id) {
      const deliveryChannel = memberDeliveryChannel || "both";
      for (const member of membersWithContact) {
        invitePartner(member.email?.trim() || "", member.phone?.trim() || "", member.firstName.trim(), deliveryChannel).catch(() => {});
      }
    }
    if (promoApplied) {
      markOnboardingComplete();
      localStorage.setItem(`family-os:onboarding-trial-confirmation:${session.user.id}`, "promo");
      skipOnboardingInvites();
      // Fire welcome email for promo users too
      sendWelcomeEmail({
        householdId: household?.id,
        userId: session.user.id,
        householdName: household?.name,
        userFirstName: onboardingFamilyMembers.find((m) => m.firstName.trim())?.firstName || session.user.email?.split("@")[0],
      }).catch(() => {});
      window.dispatchEvent(new Event("famos:onboarding-trial-confirmation"));
      setTrialConfirmation("promo");
      return;
    }
    markOnboardingComplete();
    skipOnboardingInvites();
    // Fire welcome email in the background (non-blocking)
    sendWelcomeEmail({
      householdId: household?.id,
      userId: session.user.id,
      householdName: household?.name,
      userFirstName: onboardingFamilyMembers.find((m) => m.firstName.trim())?.firstName || session.user.email?.split("@")[0],
    }).catch(() => {});
    const { data, error: checkoutError } = await supabase.functions.invoke("create-checkout-session", { body: { feature: "pro", billing: "monthly", onboarding: true } });
    if (checkoutError) throw checkoutError;
    if (!data?.url) throw new Error("Secure checkout could not be opened. Please try again.");
    localStorage.setItem(`family-os:onboarding-trial-pending:${session.user.id}`, "true");
    window.location.assign(data.url);
  });

  const saveMember = () => run(async () => {
    await saveMemberProfile({ profileType, calendarPreference, age, dateOfBirth, dietaryRestrictions, avatarUrl });
    if (household?.role === "owner") markOnboardingComplete();
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
          <HouseholdNameStep name={name} setName={setName} address={address} setAddress={setAddress} onAddressChange={(place) => {
            setAddress(place.address ?? "");
            setCity(place.city || "");
            setRegion(place.region || "");
            setPostalCode(place.postalCode || "");
            setCountry(place.country || "");
            setLatitude(place.latitude ?? null);
            setLongitude(place.longitude ?? null);
          }} busy={busy} refreshAccount={refreshAccount} session={session} onContinue={() => run(() => createHousehold(name, { address, city, region, postalCode, country, latitude, longitude }))} />
        ) : ownerProfileStep ? (
          <RevisedOwnerProfileStep
            familyMembers={onboardingFamilyMembers}
            setFamilyMembers={setOnboardingFamilyMembers}
            interests={familyInterests}
            toggleInterest={(interest) => setFamilyInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])}
            scheduleSources={scheduleSources}
            toggleScheduleSource={(source) => setScheduleSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source])}
            scheduleFeedUrl={scheduleFeedUrl}
            setScheduleFeedUrl={setScheduleFeedUrl}
            address={address}
            setAddress={setAddress}
            setCity={setCity}
            setRegion={setRegion}
            setPostalCode={setPostalCode}
            setCountry={setCountry}
            setLatitude={setLatitude}
            setLongitude={setLongitude}
            busy={busy}
            onSave={saveOwnerProfile}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            promoBusy={promoBusy}
            setPromoBusy={setPromoBusy}
            promoResult={promoResult}
            setPromoResult={setPromoResult}
            promoApplied={promoApplied}
            setPromoApplied={setPromoApplied}
            step={ownerStep}
            setStep={setOwnerStep}
            trialConfirmation={trialConfirmation}
            onComplete={finishRevisedOnboarding}
            signInWithGoogle={signInWithGoogle}
            googleProviderToken={googleProviderToken}
          />
        ) : memberProfileStep ? (
          <MemberProfileStep
            profileType={profileType}
            setProfileType={setProfileType}
            calendarPreference={calendarPreference}
            setCalendarPreference={setCalendarPreference}
            age={age}
            setAge={setAge}
            dateOfBirth={dateOfBirth}
            setDateOfBirth={setDateOfBirth}
            dietaryRestrictions={dietaryRestrictions}
            toggleRestriction={toggleRestriction}
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
            session={session}
            onSkip={saveMember}
            colorScheme={colorScheme}
            onColorSchemeChange={onColorSchemeChange}
          />
        ) : (
          <InviteStep
            inviteMembers={inviteMembers}
            setInviteMembers={setInviteMembers}
            busy={busy}
            invitePartner={invitePartner}
            run={run}
            skipOnboardingInvites={skipOnboardingInvites}
            memberDeliveryChannel={memberDeliveryChannel}
            updateDeliveryChannel={updateDeliveryChannel}
          />
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

function HouseholdNameStep({ name, setName, address, onAddressChange, busy, refreshAccount, session, onContinue }) {
  return (
    <>
      <TextField label="Household name" placeholder="e.g. The Miller Family" value={name} onChange={(e) => setName(e.target.value)} required />
      <AddressAutocomplete
        label="Home address"
        value={address}
        placeholder="Start typing your home address"
        onChange={onAddressChange}
      />
      <PrimaryButton disabled={busy || !name.trim() || !address.trim()} onClick={onContinue}>{busy ? "Creating…" : "Continue"}</PrimaryButton>
      {/* Escape hatch: arriving on this screen usually means the membership
          lookup failed transiently on the previous refresh. Give the user a
          one-tap re-fetch before they consider signing out entirely. */}
      <button
        type="button"
        className="onboarding-retry-button"
        disabled={busy || !refreshAccount || !session}
        onClick={() => refreshAccount?.(session)}
        title="Re-check whether we're missing a household you're already a member of"
      >
        I already set up my home — check again
      </button>
    </>
  );
}

const REVISED_INTERESTS = ["Sports", "Outdoors", "School", "Dance & gymnastics", "Music & lessons", "Travel", "Pets", "Cottage / second home", "New baby", "Teen driver"];
const REVISED_SCHEDULE_SOURCES = [
  ["google", "Google Calendar", CalendarDays],
  ["apple", "Apple Calendar", Smartphone],
  ["outlook", "Outlook", Mail],
  ["feed", "Team / school calendar feed", CalendarDays],
];

function RevisedOwnerProfileStep({ familyMembers, setFamilyMembers, interests, toggleInterest, scheduleSources, toggleScheduleSource, scheduleFeedUrl, setScheduleFeedUrl, busy, onSave, promoCode, setPromoCode, promoBusy, setPromoBusy, promoResult, setPromoResult, promoApplied, setPromoApplied, step, setStep, trialConfirmation, onComplete, signInWithGoogle, googleProviderToken }) {
  const steps = ["Your family", "What keeps you busy?", "Bring in your schedule", "Your family is ready", "Unlock FamOS"];
  const updateMember = (index, key, value) => setFamilyMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, [key]: value } : member));
  const addMember = () => setFamilyMembers((current) => [...current, { firstName: "", relationship: "", birthday: "", email: "", phone: "" }]);
  const removeMember = (index) => setFamilyMembers((current) => current.length === 1 ? current : current.filter((_, memberIndex) => memberIndex !== index));
  const canContinue = step === 0 ? familyMembers.some((member) => member.firstName.trim()) : true;

  if (trialConfirmation) return <RevisedTrialConfirmation promo={trialConfirmation === "promo"} onComplete={onComplete} />;

  return (
    <div className="guided-onboarding revised-onboarding">
      <OnboardingProgress steps={steps} current={step} />
      <div className="guided-onboarding-panel">
        {step === 0 && <>
          <div className="onboarding-value-heading"><UsersRound size={19} /><div><strong>Add your family</strong><span>Add the people you plan around. You can add or edit members later.</span></div></div>          <div className="revised-family-list">
            {familyMembers.map((member, index) => <div className="revised-family-row" key={index}>
              <div className="revised-family-row-main">
                <TextField label="First name" placeholder="e.g. Leo" value={member.firstName} onChange={(event) => updateMember(index, "firstName", event.target.value)} />
                <TextField label="Relationship" placeholder="e.g. child" value={member.relationship} onChange={(event) => updateMember(index, "relationship", event.target.value)} />
                <TextField type="date" label="Birthday" value={member.birthday} onChange={(event) => updateMember(index, "birthday", event.target.value)} />
                {familyMembers.length > 1 && <button type="button" className="revised-remove-member" onClick={() => removeMember(index)} aria-label={`Remove ${member.firstName || `family member ${index + 1}`}`}><Trash2 size={15} /></button>}
              </div>
              <div className="revised-family-row-invite">
                <span className="revised-invite-label"><Mail size={13} /> Invite (optional)</span>
                <TextField type="email" label="Email" placeholder="sam@example.com" value={member.email || ""} onChange={(event) => updateMember(index, "email", event.target.value)} autoComplete="email" />
                <TextField type="tel" label="Mobile" placeholder="+1 (416) 555-0123" value={member.phone || ""} onChange={(event) => updateMember(index, "phone", formatPhoneInput(event.target.value))} autoComplete="tel" inputMode="tel" />
              </div>
            </div>)}</div>
          <button type="button" className="onboarding-add-invite" onClick={addMember}><Plus size={16} /> Add another person</button>
        </>}
        {step === 1 && <>
          <div className="onboarding-value-heading"><Sparkles size={19} /><div><strong>What keeps your family busy?</strong><span>Choose anything that sounds like your household. This helps FamOS shape your first view.</span></div></div>
          <div className="revised-interest-grid">{REVISED_INTERESTS.map((interest) => <button type="button" key={interest} className={interests.includes(interest) ? "selected" : ""} onClick={() => toggleInterest(interest)}>{interest}{interests.includes(interest) && <Check size={15} />}</button>)}</div>
        </>}
        {step === 2 && <>
          <div className="onboarding-value-heading"><CalendarDays size={19} /><div><strong>Bring in your schedule</strong><span>Connect a calendar now or add things yourself later.</span></div></div>
          <div className="revised-schedule-grid">{REVISED_SCHEDULE_SOURCES.map(([id, label, Icon]) => <button type="button" key={id} className={scheduleSources.includes(id) ? "selected" : ""} onClick={() => toggleScheduleSource(id)}><Icon size={18} /><span>{label}</span>{scheduleSources.includes(id) && <Check size={15} />}</button>)}</div>
          {scheduleSources.includes("google") && <GoogleCalendarStep signInWithGoogle={signInWithGoogle} googleProviderToken={googleProviderToken} busy={busy} run={async (action) => action()} />}
          {scheduleSources.includes("feed") && <TextField label="Team or school calendar feed URL" value={scheduleFeedUrl} onChange={(event) => setScheduleFeedUrl(event.target.value)} placeholder="https://…" type="url" />}
          <button type="button" className={`revised-manual-schedule${scheduleSources.includes("manual") ? " selected" : ""}`} onClick={() => toggleScheduleSource("manual")}><Check size={16} /> I’ll add things myself</button>
        </>}
        {step === 3 && <RevisedValueScreen familyMembers={familyMembers} interests={interests} />}
        {step === 4 && <RevisedTrialGate promoCode={promoCode} setPromoCode={setPromoCode} promoBusy={promoBusy} setPromoBusy={setPromoBusy} promoResult={promoResult} setPromoResult={setPromoResult} promoApplied={promoApplied} setPromoApplied={setPromoApplied} />}
      </div>
      <div className="onboarding-actions">
        {step > 0 ? <SecondaryButton type="button" disabled={busy} onClick={() => setStep((current) => Math.max(0, current - 1))}><ChevronLeft size={16} /> Back</SecondaryButton> : <span />}
        {step < 3 && <PrimaryButton type="button" disabled={busy || !canContinue} onClick={() => setStep((current) => Math.min(4, current + 1))}>{step === 0 ? "That’s Everyone" : step === 2 ? "Build My FamOS" : "Continue"}</PrimaryButton>}
        {step === 3 && <PrimaryButton type="button" disabled={busy} onClick={() => setStep(4)}>Unlock Full FamOS</PrimaryButton>}
        {step === 4 && <PrimaryButton type="button" disabled={busy || promoBusy} onClick={onSave}>{busy ? "Opening secure checkout…" : promoApplied ? "Start FamOS Pro" : "Start My 30-Day Free Trial"}</PrimaryButton>}
      </div>
      {step === 4 && <p className="revised-trial-secondary">You won’t be charged today. Cancel anytime during your trial.</p>}
    </div>
  );
}

function RevisedValueScreen({ familyMembers, interests }) {
  const activityCount = Math.max(3, Math.min(9, familyMembers.length + (interests.length ? 2 : 0)));
  return <div className="revised-value-screen">
    <div className="onboarding-value-heading"><Check size={20} /><div><strong>Your family is ready</strong><span>Here’s a quick look at the week FamOS can help coordinate.</span></div></div>
    <div className="revised-value-metrics"><div><strong>{activityCount}</strong><span>activities this week</span></div><div><strong>1</strong><span>transportation gap</span></div><div><strong>2</strong><span>things need attention</span></div></div>
    <div className="revised-value-items"><article><CalendarDays size={16} /><div><strong>Soccer practice</strong><span>Thursday · 5:00 PM · Shared with family</span></div></article><article><ShoppingCart size={16} /><div><strong>Milk and bananas</strong><span>Shopping list · ready to pick up</span></div></article><article><CheckSquare size={16} /><div><strong>Pack school bags</strong><span>Task · needs attention</span></div></article></div>
  </div>;
}

function RevisedTrialGate({ promoCode, setPromoCode, promoBusy, setPromoBusy, promoResult, setPromoResult, promoApplied, setPromoApplied }) {
  const features = ["Unlimited family activities", "Smart schedule coordination", "Ride planning and driver assignments", "Activity Readiness", "Weekly Family Game Plan", "Fam AI actions", "Smart screenshot and document import", "Advanced calendar integrations", "Caregiver access", "Advanced routines", "Family lifecycle packs"];
  return <div className="revised-trial-gate">
    <div className="onboarding-value-heading"><ShieldCheck size={20} /><div><strong>Try everything FamOS can do for 30 days.</strong><span>Start your 30-day FamOS Pro trial today. You’ll get every premium feature during your trial. If you decide not to continue, your household can stay on FamOS Core with the free features.</span></div></div>
    <h3>FamOS Pro — 30 Days Free</h3>
    <ul className="revised-trial-features">{features.map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
    <div className="revised-trial-price"><strong>{formatMoney(PRICING_PLAN.plans.find((plan) => plan.id === "pro")?.price.monthly || 0)}</strong><span>/month after your trial</span></div>
    <div className="onboarding-promo-field"><label>Promo code</label><div className="onboarding-promo-row"><input value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")); setPromoApplied(false); }} placeholder="Have a promo code?" disabled={promoBusy || promoApplied} />{promoCode.trim().length >= 3 && !promoApplied && <button type="button" className="onboarding-promo-apply" disabled={promoBusy} onClick={async () => { setPromoBusy(true); setPromoResult(""); try { const { data, error } = await supabase.rpc("apply_my_promo_code", { promo_code: promoCode.trim() }); if (error) throw error; setPromoApplied(true); setPromoResult(data || "Promo code applied. Pro is unlocked."); } catch (error) { setPromoApplied(false); setPromoResult(error.message || "Invalid promo code."); } finally { setPromoBusy(false); } }}> {promoBusy ? "Applying…" : "Apply"}</button>}</div>{promoResult && <p className={`onboarding-promo-result ${promoApplied ? "success" : "error"}`}>{promoResult}</p>}</div>
    <p className="revised-trial-note">Cancel anytime during your trial. You won’t be charged today.</p>
  </div>;
}

function RevisedTrialConfirmation({ onComplete }) {
  const trialEnds = new Date(Date.now() + PRICING_PLAN.trial.days * 86400000).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const proPlan = PRICING_PLAN.plans.find((plan) => plan.id === "pro");
  return <div className="revised-trial-confirmation"><div className="onboarding-value-heading"><Check size={22} /><div><strong>You’re on FamOS Pro.</strong><span>Your 30-day trial has started.</span></div></div><div className="revised-trial-summary"><div><span>Trial ends</span><strong>{trialEnds}</strong></div><div><span>Today</span><strong>$0</strong></div><div><span>After trial</span><strong>{formatMoney(proPlan?.price.monthly || 0)}/month</strong></div></div><PrimaryButton type="button" onClick={onComplete}>Start Using FamOS</PrimaryButton><button type="button" className="revised-manual-schedule" onClick={() => window.location.assign("/settings")}>Manage Subscription</button></div>;
}

function OwnerProfileStep(props) {
  const restrictions = [
    ["Vegetarian", Leaf], ["Vegan", Salad], ["Gluten-free", WheatOff], ["Dairy-free", ChefHat],
    ["Nut-free", HeartHandshake], ["Shellfish-free", ShieldCheck], ["Low sugar", Sparkles],
  ];
  const steps = ["Household", "Address", "Calendar", "Task lists", "Food", "Shopping", "Your look", "Start trial"];
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

        {props.step === 2 && <GoogleCalendarStep signInWithGoogle={props.signInWithGoogle} googleProviderToken={props.googleProviderToken} busy={props.busy} run={props.run} />}

        {props.step === 3 && <TaskImportStep value={props.taskImportText} onChange={props.setTaskImportText} />}

        {props.step === 4 && <>
          <div className="onboarding-choice-group">
            <span><ChefHat size={15} /> Dietary preferences</span>
            <div>{restrictions.map(([restriction, Icon]) => <button type="button" key={restriction} className={props.dietaryRestrictions.includes(restriction) ? "selected" : ""} onClick={() => props.toggleRestriction(restriction)}><Icon size={15} />{restriction}</button>)}</div>
          </div>
          <div className="onboarding-grid onboarding-grid-two">
            <label className="onboarding-field"><span>Avoid ingredients</span><textarea placeholder="e.g. peanuts, cilantro" value={props.avoidIngredients} onChange={(e) => props.setAvoidIngredients(e.target.value)} /></label>
            <label className="onboarding-field"><span>Meal notes</span><textarea placeholder="e.g. quick school-night dinners" value={props.mealNotes} onChange={(e) => props.setMealNotes(e.target.value)} /></label>
          </div>
        </>}

        {props.step === 5 && <label className="onboarding-field onboarding-full onboarding-grocery-import"><span><ShoppingCart size={15} /> Paste your current shopping list</span><textarea placeholder={"Milk\nEggs\nBananas x6\nGreek yogurt"} value={props.groceryImportText} onChange={(e) => props.setGroceryImportText(e.target.value)} /><small>One item per line works best. We’ll add them to your shopping list and remember them as staples.</small></label>}

        {props.step === 6 && <OnboardingColourScheme value={props.colorScheme} onChange={props.onColorSchemeChange} />}



        {props.step === 7 && <div className="onboarding-trial-step">
          <div className="onboarding-trial-card">
            <h3>Start your 30-day FamOS Pro trial</h3>
            <p>Unlock every Pro feature for 30 days. Add a card through secure Stripe checkout and you won’t be charged until the trial ends. Cancel anytime before then.</p>
            <div className="onboarding-trial-features">
              <span>Google & Outlook two-way sync</span>
              <span>Recipe discovery, meal planning, and Cook Mode</span>
              <span>250–300 FamAI queries per month</span>
              <span>Up to 5 connected calendars</span>
              <span>Priority support</span>
            </div>
            <div className="onboarding-promo-field">
              <label>Promo code</label>
              <div className="onboarding-promo-row">
                <input
                  value={props.promoCode}
                  onChange={(e) => { props.setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")); props.setPromoApplied(false); }}
                  placeholder="Enter code to skip card details"
                  disabled={props.promoBusy || props.promoApplied}
                  maxLength={32}
                />
                {props.promoCode.trim().length >= 3 && !props.promoApplied && (
                  <button
                    type="button"
                    className="onboarding-promo-apply"
                    disabled={props.promoBusy}
                    onClick={async () => {
                      props.setPromoBusy(true);
                      props.setPromoResult("");
                      try {
                        const { data, error } = await supabase.rpc("apply_my_promo_code", { promo_code: props.promoCode.trim() });
                        if (error) throw error;
                        props.setPromoApplied(true);
                        props.setPromoResult(data || "Promo code applied. Pro is unlocked.");
                      } catch (e) {
                        props.setPromoApplied(false);
                        props.setPromoResult(e.message || "Invalid promo code.");
                      } finally {
                        props.setPromoBusy(false);
                      }
                    }}
                  >{props.promoBusy ? "Applying…" : "Apply"}</button>
                )}
              </div>
              {props.promoResult && <p className={`onboarding-promo-result ${props.promoApplied ? "success" : "error"}`}>{props.promoResult}</p>}
            </div>
          </div>
        </div>}
      </div>
      <OnboardingActions
        step={props.step}
        lastStep={steps.length - 1}
        busy={props.busy}
        nextDisabled={props.step === 0 && !basicsValid}
        nextLabel={
          (props.step === 1 && !props.address.trim())
          || (props.step === 3 && !props.taskImportText.trim())
          || (props.step === 4 && !props.dietaryRestrictions.length && !props.avoidIngredients.trim() && !props.mealNotes.trim())
          || (props.step === 5 && !props.groceryImportText.trim())
            ? "Skip for now"
            : undefined
        }
        onBack={() => props.setStep((step) => Math.max(0, step - 1))}
        onNext={next}
        onFinish={props.onSave}
        finishLabel={props.promoApplied ? "Unlock FamOS Pro" : "Start Pro trial"}
      />
    </div>
  );
}

function TaskImportStep({ value, onChange }) {
  return (
    <label className="onboarding-field onboarding-full onboarding-grocery-import">
      <span><CheckSquare size={15} /> Bring in existing task lists</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={"Book the dentist\nPick up prescriptions\nReturn library books"} />
      <small>Paste tasks from Apple Reminders, Google Tasks, Microsoft To Do, or any plain-text list. One task per line. FamOS reviews and imports them into a new task list.</small>
    </label>
  );
}

function MemberProfileStep({ profileType, setProfileType, calendarPreference, setCalendarPreference, age, setAge, dateOfBirth, setDateOfBirth, dietaryRestrictions, toggleRestriction, signInWithGoogle, googleProviderToken, busy, run, onSave, onSkip, step, setStep, avatarUrl, setAvatarUrl, avatarStatus, setAvatarStatus, colorScheme, onColorSchemeChange }) {
  const steps = ["About you", "Food", "Calendar", "Your look"];
  const restrictions = [["Vegetarian", Leaf], ["Vegan", Salad], ["Gluten-free", WheatOff], ["Dairy-free", MilkOff], ["Nut-free", ShieldCheck]];
  return (
    <div className="guided-onboarding">
      <OnboardingProgress steps={steps} current={step} />
      <div className="personal-onboarding-note"><Sparkles size={16} /><p><strong>Personalize your FamOS profile</strong><span>All fields are optional. This information helps us tailor your experience to you.</span></p></div>
      <div className="guided-onboarding-panel">
        {step === 0 && <>
          <OnboardingChoiceGroup icon={<UsersRound size={15} />} label="Family member type" value={profileType} onChange={setProfileType} options={[["parent", "Parent / guardian", UserRound], ["child", "Child", Baby], ["grandparent", "Grandparent", HeartHandshake]]} />
          <div className="onboarding-grid onboarding-grid-two personal-profile-fields">
            <TextField type="number" min="0" max="120" inputMode="numeric" label="Age (optional)" placeholder="e.g. 34" value={age} onChange={(event) => setAge(event.target.value)} />
            <DateField label="Date of birth (optional)" value={dateOfBirth} onChange={setDateOfBirth} max={new Date().toISOString().slice(0, 10)} />
          </div>
        </>}
        {step === 1 && <div className="onboarding-choice-group">
          <span><Salad size={15} /> Dietary preferences (optional)</span>
          <div>{restrictions.map(([restriction, Icon]) => <button type="button" key={restriction} className={dietaryRestrictions.includes(restriction) ? "selected" : ""} onClick={() => toggleRestriction(restriction)}><Icon size={15} />{restriction}{dietaryRestrictions.includes(restriction) && <Check size={13} />}</button>)}</div>
          <small className="personal-onboarding-helper">Used to tailor meal and shopping suggestions. You can change this anytime in Settings.</small>
        </div>}
        {step === 2 && <>
          <OnboardingChoiceGroup icon={<CalendarDays size={15} />} label="Default calendar view" value={calendarPreference} onChange={setCalendarPreference} options={[["family", "Shared family calendar", UsersRound], ["personal", "My calendar first", UserRound]]} />
          <GoogleCalendarStep signInWithGoogle={signInWithGoogle} googleProviderToken={googleProviderToken} busy={busy} run={run} />
        </>}
        {step === 3 && <><OnboardingColourScheme value={colorScheme} onChange={onColorSchemeChange} /><AvatarPicker avatarUrl={avatarUrl} setAvatarUrl={setAvatarUrl} status={avatarStatus} setStatus={setAvatarStatus} /></>}
      </div>
      <OnboardingActions step={step} lastStep={3} busy={busy} onBack={() => setStep((prev) => Math.max(0, prev - 1))} onNext={() => setStep((prev) => Math.min(prev + 1, 3))} onFinish={onSave} finishLabel="Enter FamOS" />
      <button type="button" className="personal-onboarding-skip" disabled={busy} onClick={onSkip}>Skip for now and enter FamOS</button>
    </div>
  );
}

function OnboardingColourScheme({ value, onChange }) {
  return (
    <div className="onboarding-scheme-picker">
      <span><Palette size={15}/> Make it yours</span>
      <p>Choose the app colours you'll see. This only changes your view, not anyone else's.</p>
      <ColorSchemePicker
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function OnboardingProgress({ steps, current }) {
  return (
    <div className="onboarding-progress" aria-label={`Step ${current + 1} of ${steps.length}`}>
      <div className="onboarding-progress-copy"><span>Step {current + 1} of {steps.length}</span><strong>{steps[current]}</strong></div>
      <ProgressBar value={current + 1} max={steps.length} size="sm" />
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

function InviteStep({ inviteMembers, setInviteMembers, busy, invitePartner, run, skipOnboardingInvites, memberDeliveryChannel, updateDeliveryChannel }) {
  const [deliveryChannel, setDeliveryChannel] = useState(memberDeliveryChannel || "both");
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
      results.push(await invitePartner(member.email, member.phone, member.name, deliveryChannel));
    }
    const failed = results.find((result) => !result?.sent && !result?.pending);
    if (failed) throw new Error(failed.message || "The invitation was saved, but delivery could not be confirmed.");
    // Persist the inviter's choice on their household_members row so future
    // invitations from Settings → Family / quick-invite uses the same
    // channel automatically — no need to re-pick next time.
    if (updateDeliveryChannel && deliveryChannel && deliveryChannel !== memberDeliveryChannel) {
      try { await updateDeliveryChannel(deliveryChannel); } catch { /* best-effort */ }
    }
    skipOnboardingInvites();
  });

  const channelHint = {
    email: "Each invite goes out as a branded email. SMS numbers are skipped.",
    sms: "Each invite goes out as one transactional SMS. Email addresses are skipped.",
    both: "Each invite goes out by email AND a one-time SMS — the most reliable option.",
  }[deliveryChannel] || "";

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
      <DeliveryPreferencePicker value={deliveryChannel} onChange={setDeliveryChannel} disabled={busy} />
      <p className="onboarding-hint onboarding-hint-channel">{channelHint}</p>
      <PrimaryButton disabled={busy || !inviteMembers.some((member) => member.name.trim() || member.email.trim() || member.phone.trim())} onClick={sendInvites}>{busy ? "Sending invites…" : "Send invites & continue"}</PrimaryButton>
      <SecondaryButton type="button" className="mt-2 onboarding-skip-button" disabled={busy} onClick={skipOnboardingInvites}>Skip for now</SecondaryButton>
    </>
  );
}

function DeliveryPreferencePicker({ value, onChange, disabled }) {
  const options = [
    { id: "email", label: "Email only", sublabel: "Branded invitations by inbox.", Icon: Mail },
    { id: "sms", label: "SMS only", sublabel: "One transactional text per invite.", Icon: Smartphone },
    { id: "both", label: "Email + SMS", sublabel: "Both channels for max reach.", Icon: Send },
  ];
  return (
    <div className="onboarding-choice-group onboarding-channel-picker" role="radiogroup" aria-label="Delivery channel for invitations">
      <span><Mail size={15} /> Delivery preferences</span>
      <div>
        {options.map(({ id, label, sublabel, Icon }) => {
          const selected = value === id;
          return (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              className={selected ? "selected onboarding-channel-card" : "onboarding-channel-card"}
              onClick={() => onChange(id)}
            >
              <span className="onboarding-channel-icon"><Icon size={16} /></span>
              <span className="onboarding-channel-copy">
                <strong>{label}</strong>
                <small>{sublabel}</small>
              </span>
              {selected && <Check size={15} className="onboarding-channel-check" />}
            </button>
          );
        })}
      </div>
    </div>
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

function NotificationStep({ user, busy, run }) {
  const [status, setStatus] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [notifBusy, setNotifBusy] = useState(false);
  const [enabled, setEnabled] = useState(() => Notification.permission === "granted");

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    setNotifBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission);
      if (permission === "granted") {
        setEnabled(true);
        // Register the push subscription if user is signed in.
        if (user?.id && "PushManager" in window) {
          try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
              });
            }
            const deviceLabel = [
              navigator.userAgentData?.platform || navigator.platform,
              /iPhone|iPad/.test(navigator.userAgent) ? "iOS Home Screen" : "",
            ].filter(Boolean).join(" · ");
            const { error } = await supabase.from("push_subscriptions").upsert({
              user_id: user.id,
              endpoint: subscription.endpoint,
              subscription: subscription.toJSON(),
              device_label: deviceLabel,
            }, { onConflict: "user_id,endpoint" });
            if (error) throw error;
          } catch (pushError) {
            console.warn("Could not register for push.", pushError);
          }
        }
      }
    } catch (e) {
      console.warn("Could not request notification permission.", e);
    } finally {
      setNotifBusy(false);
    }
  };

  return (
    <div className="onboarding-notification-step">
      <div className="onboarding-notification-hero">
        <BellRing size={32} />
      </div>
      <p className="onboarding-notification-intro">
        Stay in the loop with household notifications on every device.
      </p>
      <div className="onboarding-notification-features">
        <div><Bell size={16} /><span>New task assignments</span></div>
        <div><MessageCircle size={16} /><span>Chat messages from the family</span></div>
        <div><ShoppingCart size={16} /><span>Shopping list updates</span></div>
        <div><ChefHat size={16} /><span>Meal reminders & cooking assignments</span></div>
        <div><CalendarDays size={16} /><span>Calendar event notifications</span></div>
      </div>
      {status === "denied" && (
        <div className="onboarding-notification-blocked">
          <span>Notifications are blocked in your browser settings. You can enable them later in Settings → Notifications.</span>
        </div>
      )}
      {status === "unsupported" && (
        <div className="onboarding-notification-blocked">
          <span>Notifications aren't supported on this browser. Install FamOS to your home screen to enable them.</span>
        </div>
      )}
      <div className="onboarding-notification-action">
        {status === "granted" || enabled ? (
          <div className="onboarding-notification-enabled">
            <BellRing size={18} />
            <span>Notifications are enabled</span>
          </div>
        ) : status !== "denied" && status !== "unsupported" ? (
          <PrimaryButton
            type="button"
            disabled={notifBusy || busy}
            onClick={enableNotifications}
          >
            {notifBusy ? "Enabling…" : "Enable notifications"}
          </PrimaryButton>
        ) : null}
      </div>
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
        <span><UserRound size={15} /> Your avatar</span>
        <div className="onboarding-avatar-actions">
          <label><input type="file" accept="image/*" onChange={uploadAvatar} /><ImagePlus size={15} /> Upload photo</label>
        </div>
      </div>
      {avatarUrl?.startsWith("data:") && <div className="avatar-preview"><img src={avatarUrl} alt="Your uploaded avatar" /></div>}
      {status && <p className="avatar-status">{status}</p>}
      <p className="avatar-preset-note">Upload a photo, or your initials will be used.</p>
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
