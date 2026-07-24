import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { invokeEdgeFunction, isSupabaseConfigured, supabase } from "../lib/supabase";
import { passwordError } from "../utils/passwordStrength";

const AuthContext = createContext(null);
const STAPLES_KEY = "family-os:grocery-staples:v1";

function onboardingSkipKey(householdId, userId) {
  return `family-os:onboarding-invites-skipped:${householdId}:${userId}`;
}

function onboardingProfileKey(householdId, userId) {
  return `family-os:onboarding-profile-complete:${householdId}:${userId}`;
}

function memberProfileKey(householdId, userId) {
  return `family-os:member-profile:${householdId}:${userId}`;
}

function householdProfileExtraKey(householdId) {
  return `family-os:household-profile-extra:${householdId}`;
}

const GROCERY_CATEGORY_RULES = [
  ["Dairy & Eggs", ["milk", "egg", "yogurt", "yoghurt", "cheese", "butter", "cream", "kefir"]],
  ["Produce", ["apple", "banana", "broccoli", "lettuce", "spinach", "avocado", "tomato", "garlic", "onion", "potato", "carrot", "berry", "berries", "cilantro", "pepper", "orange", "lemon", "lime", "grape"]],
  ["Bakery", ["bread", "bagel", "bun", "tortilla", "pita", "croissant", "muffin"]],
  ["Meat & Seafood", ["chicken", "beef", "pork", "turkey", "salmon", "tuna", "shrimp", "fish", "steak", "sausage"]],
  ["Pantry", ["rice", "pasta", "flour", "sugar", "oil", "vinegar", "oats", "beans", "lentils", "cereal", "quinoa", "sauce"]],
  ["Snacks & Candy", ["chips", "crackers", "cookies", "granola", "snack", "candy", "chocolate", "popcorn"]],
  ["Beverages", ["juice", "coffee", "tea", "soda", "sparkling water", "water", "kombucha"]],
  ["Frozen", ["frozen", "ice cream", "popsicle"]],
  ["Baby", ["diaper", "wipes", "formula", "baby food"]],
  ["Pet Supplies", ["dog", "cat", "pet", "litter", "kibble"]],
  ["Household & Cleaning", ["detergent", "soap", "cleaner", "paper towel", "toilet paper", "dishwasher", "trash bag"]],
];

function inferGroceryCategory(name = "") {
  const normalized = name.toLowerCase();
  const match = GROCERY_CATEGORY_RULES.find(([, terms]) => terms.some((term) => normalized.includes(term)));
  return match?.[0] || "Other";
}

function parseGroceryLines(text = "") {
  return text
    .split(/[\n,]+/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .map((line) => {
      let cleaned = line;
      let quantity = 1;
      let unit = "";
      const trailing = cleaned.match(/^(.*?)\s+(?:x\s*)?(\d+(?:\.\d+)?)\s*([a-zA-Z ]+)?$/);
      const leading = cleaned.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
      if (trailing && trailing[1] && !/^\d/.test(cleaned)) {
        cleaned = trailing[1].trim();
        quantity = Number(trailing[2]) || 1;
        unit = (trailing[3] || "").trim();
      } else if (leading) {
        quantity = Number(leading[1]) || 1;
        cleaned = leading[2].trim();
      }
      return {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: cleaned,
        category: inferGroceryCategory(cleaned),
        quantity,
        unit,
        staple: true,
      };
    });
}

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function importStapleGroceries(text, householdId, userId) {
  const parsed = parseGroceryLines(text);
  if (!parsed.length) return;
  const existing = readJson(STAPLES_KEY, []);
  const deduped = [...existing];
  parsed.forEach((item) => {
    const alreadyExists = deduped.some((existingItem) => existingItem.name?.toLowerCase() === item.name.toLowerCase());
    if (!alreadyExists) deduped.push(item);
  });
  localStorage.setItem(STAPLES_KEY, JSON.stringify(deduped));

  if (!supabase || !householdId) return;
  try {
    const { data: existingRows, error: existingRowsError } = await supabase
      .from("grocery_items")
      .select("name")
      .eq("household_id", householdId);
    if (existingRowsError) throw existingRowsError;
    const existingNames = new Set((existingRows || []).map((item) => item.name?.trim().toLowerCase()).filter(Boolean));
    const rows = parsed.filter((item) => !existingNames.has(item.name.toLowerCase())).map((item) => ({
      household_id: householdId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      added_by: userId,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from("grocery_items").insert(rows);
    if (error && !/schema cache|does not exist|column/i.test(error.message || "")) console.warn("Could not import onboarding groceries.", error);
  } catch (error) {
    console.warn("Could not import onboarding groceries.", error);
  }
}

async function getFunctionErrorMessage(functionError) {
  const response = functionError?.context;
  try {
    if (response) {
      const readable = response.clone ? response.clone() : response;
      const text = await readable.text();
      const payload = text ? JSON.parse(text) : null;
      if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
      if (payload?.error?.message) return payload.error.message;
      if (payload?.message) return payload.message;
      if (text && text !== "{}") return `${text} (HTTP ${response.status || "error"})`;
    }
  } catch {
    // FunctionFetchError does not always include a parseable response.
  }
  const message = functionError?.message;
  return message && message !== "{}"
    ? message
    : `Invitation service returned ${response?.status || "an unexpected error"}. Please try again.`;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [household, setHousehold] = useState(null);
  const [householdProfile, setHouseholdProfile] = useState(null);
  const [householdProfileExtra, setHouseholdProfileExtra] = useState(null);
  const [memberProfile, setMemberProfile] = useState(null);
  const [memberDeliveryChannel, setMemberDeliveryChannel] = useState("both");
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  // The full-screen loader should only show on the FIRST account load. Later
  // refreshes (token refresh, window focus) run silently so the app doesn't
  // flash the loading screen repeatedly.
  const hasLoadedOnce = useRef(false);
  const [error, setError] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => {
    const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authQuery = new URLSearchParams(window.location.search);
    return authHash.get("type") === "invite" || authQuery.get("type") === "invite" || authQuery.get("invite") === "1";
  });
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [googleProviderToken, setGoogleProviderToken] = useState(() => localStorage.getItem("family-os:google-provider-token"));

  const refreshAccount = useCallback(async (nextSession) => {
    if (!supabase || !nextSession?.user) {
      setProfile(null);
      setHousehold(null);
      setHouseholdProfile(null);
      setHouseholdProfileExtra(null);
      setMemberProfile(null);
      setMemberDeliveryChannel("both");
      setInvitation(null);
      setLoading(false);
      hasLoadedOnce.current = true;
      setOnboardingRequired(false);
      return;
    }

    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      // A household creator is the permanent master owner. Repairing this
      // invariant before loading membership prevents an existing owner from
      // ever being routed through first-time household onboarding.
      const { error: ownerRepairError } = await supabase.rpc("ensure_creator_household_membership");
      if (ownerRepairError && ownerRepairError.code !== "PGRST202" && !/schema cache|could not find the function/i.test(ownerRepairError.message || "")) {
        throw ownerRepairError;
      }
      const [{ data: profileData, error: profileError }, { data: membershipData, error: membershipError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", nextSession.user.id).maybeSingle(),
        supabase.from("household_members").select("household_id, role, default_delivery_channel").eq("user_id", nextSession.user.id).order("joined_at", { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (profileError && profileError.code !== "PGRST116") throw profileError;
      if (membershipError) throw membershipError;

      const fallbackProfile = {
        id: nextSession.user.id,
        email: nextSession.user.email || "",
        display_name: nextSession.user.user_metadata?.display_name || nextSession.user.user_metadata?.full_name || nextSession.user.user_metadata?.name || (nextSession.user.email || "").split("@")[0] || "Family member",
        initials: ((nextSession.user.user_metadata?.display_name || nextSession.user.user_metadata?.full_name || nextSession.user.user_metadata?.name || nextSession.user.email || "?")
          .trim()
          .split(/\s+|@/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("") || "?"),
      };
      const accountProfile = profileData || fallbackProfile;
      let membership = membershipData;
      // Track the inviter's chosen delivery-channel preference so future
      // flows (Settings → Family, "Invite" CTA) use the same routing the
      // onboarding step committed to. Defaults to "both" so a member who
      // hasn't opened onboarding yet still gets the current behaviour.
      setMemberDeliveryChannel(membership?.default_delivery_channel || "both");

      let householdData = null;
      let householdProfileData = null;
      let householdProfileExtraData = null;
      let localMemberProfile = null;

      if (membership?.household_id) {
        const { data, error: householdError } = await supabase.from("households").select("id, name, created_by").eq("id", membership.household_id).maybeSingle();
        if (householdError && householdError.code !== "PGRST116") console.warn("Could not load household details; using membership fallback.", householdError);
        householdData = data || { id: membership.household_id, name: "Home" };

        const { data: profileRow, error: householdProfileError } = await supabase
          .from("household_profiles")
          .select("*")
          .eq("household_id", membership.household_id)
          .maybeSingle();
        if (householdProfileError && householdProfileError.code !== "42P01" && !/does not exist|schema cache/i.test(householdProfileError.message || "")) {
          throw householdProfileError;
        }
        householdProfileData = profileRow || null;
        const localHouseholdExtra = readJson(householdProfileExtraKey(membership.household_id), null);
        householdProfileExtraData = profileRow ? {
          profileType: profileRow.profile_type || localHouseholdExtra?.profileType || "parent",
          dietaryRestrictions: profileRow.dietary_restrictions || localHouseholdExtra?.dietaryRestrictions || [],
          avoidIngredients: profileRow.avoid_ingredients || localHouseholdExtra?.avoidIngredients || "",
          mealNotes: profileRow.meal_notes || localHouseholdExtra?.mealNotes || "",
          city: profileRow.city || localHouseholdExtra?.city || "",
          region: profileRow.region || localHouseholdExtra?.region || "",
          postalCode: profileRow.postal_code || localHouseholdExtra?.postalCode || "",
          country: profileRow.country || localHouseholdExtra?.country || "",
          address: profileRow.address || localHouseholdExtra?.address || "",
          latitude: profileRow.latitude ?? localHouseholdExtra?.latitude ?? null,
          longitude: profileRow.longitude ?? localHouseholdExtra?.longitude ?? null,
          updatedAt: profileRow.updated_at || localHouseholdExtra?.updatedAt || null,
        } : localHouseholdExtra;

        const localMemberFallback = readJson(memberProfileKey(membership.household_id, nextSession.user.id), null);
        const { data: memberProfileRow, error: memberProfileError } = await supabase
          .from("household_member_profiles")
          .select("profile_type, calendar_preference, completed_at")
          .eq("household_id", membership.household_id)
          .eq("user_id", nextSession.user.id)
          .maybeSingle();
        if (memberProfileError && memberProfileError.code !== "42P01" && !/does not exist|schema cache/i.test(memberProfileError.message || "")) {
          throw memberProfileError;
        }
        localMemberProfile = memberProfileRow ? {
          profileType: memberProfileRow.profile_type,
          calendarPreference: memberProfileRow.calendar_preference,
          completedAt: memberProfileRow.completed_at,
        } : localMemberFallback;
      }

      // Commit the household state up front. The profile / activity queries
      // below can throw transient PostgREST errors that bail us out of the
      // try-block before we ever set state. If we waited until the bottom
      // of the try to setHousehold, a returning user would land on the
      // "What should we call home?" gate (HouseholdNameStep) purely because
      // a single count(*) timed out. Commit membership-aware household
      // first; profile/extras will catch up once those queries resolve.
      const committedHousehold = membership && householdData ? { ...householdData, role: membership.role } : null;
      setHousehold(committedHousehold);

      const metadata = nextSession.user.user_metadata || {};
      const providerName = metadata.display_name || metadata.full_name || metadata.name || "";
      const googleAvatar = metadata.avatar_url || metadata.picture || "";
      const emailName = (nextSession.user.email || "").split("@")[0];
      const profileNameIsGeneric = !accountProfile.display_name || accountProfile.display_name.toLowerCase() === emailName.toLowerCase();
      const profilePatch = {};
      if (providerName && profileNameIsGeneric && providerName !== accountProfile.display_name) {
        profilePatch.display_name = providerName;
        profilePatch.initials = providerName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
      }
      if (googleAvatar && Object.prototype.hasOwnProperty.call(accountProfile, "avatar_url") && !accountProfile.avatar_url) {
        profilePatch.avatar_url = googleAvatar;
      }
      if (profileData && Object.keys(profilePatch).length) {
        const { error: profileUpdateError } = await supabase.from("profiles").update(profilePatch).eq("id", nextSession.user.id);
        if (!profileUpdateError) Object.assign(accountProfile, profilePatch);
      }

      setProfile(accountProfile);
      setHouseholdProfile(householdProfileData);
      setHouseholdProfileExtra(householdProfileExtraData);
      setMemberProfile(localMemberProfile);
      setMemberDeliveryChannel(membership?.default_delivery_channel || "both");

      if (membership?.role === "owner") {
        const onboardingKey = onboardingProfileKey(membership.household_id, nextSession.user.id);
        const localProfileComplete = localStorage.getItem(onboardingKey) === "true";
        let activityInferredComplete = false;
        // If we have no completed_at row AND no localStorage flag, see whether
        // the household already looks "set up" by virtue of having any
        // tasks / messages / events / meals / grocery_items. If yes, treat
        // onboarding as done and cache via the same localStorage key the
        // server-side write uses, so future refreshes skip the count query.
        //
        // Also infer completion when the household has a real name (anything
        // other than the "Home" placeholder we use when the households row
        // couldn't be loaded). A returning user who renamed their home implicitly
        // finished the name step of onboarding, so we shouldn't trap them in
        // the wizard again just because `completed_at` was lost on a deploy or
        // never written on a legacy device.
        const householdHasRealName = Boolean(householdData?.name) && householdData.name !== "Home";
        if (!householdProfileData?.completed_at && !localProfileComplete) {
          if (householdHasRealName) {
            activityInferredComplete = true;
            try { localStorage.setItem(onboardingKey, "true"); } catch { /* storage full/disabled — fine */ }
            // Backfill completed_at on the server so future devices / sign-ins
            // skip this branch entirely. Best-effort: a Supabase failure here
            // MUST NOT bubble up; localStorage is the durable cache.
            supabase
              .from("household_profiles")
              .update({ completed_at: new Date().toISOString() })
              .eq("household_id", membership.household_id)
              .then(({ error }) => {
                if (!error) setHouseholdProfile((current) => ({ ...(current || {}), completed_at: new Date().toISOString() }));
              });
          } else {
            // Wrap the count queries in their own try/catch so a single
            // PostgREST timeout or table-permission hiccup doesn't bounce the
            // whole refreshAccount — we already have membership and household
            // state set above, so this branch is best-effort only.
            try {
              const activityResults = await Promise.all([
                supabase.from("tasks").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id),
                supabase.from("messages").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id),
                supabase.from("events").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id),
                supabase.from("meals").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id),
                supabase.from("grocery_items").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id),
              ]);
              const activeTotal = activityResults.reduce((sum, result) => sum + (result.count || 0), 0);
              if (activeTotal > 0) {
                activityInferredComplete = true;
                try { localStorage.setItem(onboardingKey, "true"); } catch { /* storage full/disabled — fine */ }
              }
            } catch {
              // Activity inference is best-effort. The early setHousehold +
              // real-name inference above already keeps the user out of the
              // gate in the common case; transient count errors here just
              // fall through to the normal gate evaluation.
            }
          }
        }
        const profileComplete = Boolean(householdProfileData?.completed_at) || localProfileComplete || activityInferredComplete;
        if (!profileComplete) {
          setOnboardingRequired(true);
        } else {
          const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
            supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", membership.household_id),
            supabase.from("household_invitations").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
          ]);
          const skippedInvites = localStorage.getItem(onboardingSkipKey(membership.household_id, nextSession.user.id)) === "true";
          setOnboardingRequired(!skippedInvites && (memberCount || 0) < 2 && (inviteCount || 0) === 0);
        }
      } else if (membership?.household_id) {
        setOnboardingRequired(!localMemberProfile?.completedAt);
      } else {
        setOnboardingRequired(false);
      }

      if (!membership) {
        const { data: inviteData, error: inviteError } = await supabase
          .from("household_invitations")
          .select("id, email, expires_at, households(id, name)")
          .eq("email", nextSession.user.email.toLowerCase())
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (inviteError) throw inviteError;
        setInvitation(inviteData);
      } else {
        setInvitation(null);
      }      } catch (e) {
      setError(e.message || "Could not load your account.");
      // If a transient Supabase error bailed us out before the early
      // setHousehold() at the top of the wizard block had a chance to run
      // (e.g. on the very first login after a bad migration deploy), keep
      // what we DO know about the membership committed. This way the
      // "What should we call home?" gate won't fire on the next refresh
      // just because the profile tables were temporarily unreadable.
      if (membershipData?.household_id && committedHousehold) setHousehold(committedHousehold);
      if (membershipData?.default_delivery_channel) setMemberDeliveryChannel(membershipData.default_delivery_channel);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    // Capture the long-lived Google refresh token the one time Supabase exposes
    // it (right after OAuth consent) and hand it to the google-calendar-token
    // edge function for durable storage. Best-effort: silently a no-op until the
    // backend function is deployed.
    const captureGoogleRefreshToken = (activeSession) => {
      const refreshToken = activeSession?.provider_refresh_token;
      if (!refreshToken) return;
      invokeEdgeFunction("google-calendar-token", { action: "store", refresh_token: refreshToken, scope: "" }).catch(() => {});
    };
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.provider_token) {
        localStorage.setItem("family-os:google-provider-token", data.session.provider_token);
        setGoogleProviderToken(data.session.provider_token);
      }
      captureGoogleRefreshToken(data.session);
      refreshAccount(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      // Only an explicit sign-out should clear the session. A transient null on
      // any other event (e.g. a background token refresh that briefly fails)
      // must NOT sign the user out — Supabase will retry the refresh, and the
      // user should be able to return anytime without logging in again.
      if (event === "SIGNED_OUT") {
        hasLoadedOnce.current = false;
        setSession(null);
        localStorage.removeItem("family-os:google-provider-token");
        setGoogleProviderToken(null);
        setTimeout(() => refreshAccount(null), 0);
        return;
      }
      if (!nextSession) {
        // INITIAL_SESSION with no user is the genuine "not signed in" case and is
        // already handled by getSession() above; ignore spurious nulls otherwise.
        if (event === "INITIAL_SESSION") setTimeout(() => refreshAccount(null), 0);
        return;
      }
      setSession(nextSession);
      if (nextSession.provider_token) {
        localStorage.setItem("family-os:google-provider-token", nextSession.provider_token);
        setGoogleProviderToken(nextSession.provider_token);
      }
      captureGoogleRefreshToken(nextSession);
      setTimeout(() => refreshAccount(nextSession), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshAccount]);

  const signIn = async (email, password) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) {
      if (/invalid login credentials/i.test(signInError.message || "")) {
        const normalizedEmail = email.trim().toLowerCase();
        const { data: inviteStatus } = await supabase.functions.invoke("prepare-invited-account", {
          body: { email: normalizedEmail },
        });
        if (inviteStatus?.invited) {
          throw new Error("INVITED_ACCOUNT_PASSWORD_REQUIRED");
        }
        throw new Error("The email or password is incorrect.");
      }
      throw signInError;
    }
  };

  const signUp = async (email, password, displayName) => {
    setError(null);
    const weak = passwordError(password);
    if (weak) throw new Error(weak);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (signUpError) throw signUpError;
    if (!data.session && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("This email already has a FamOS account or invitation. Existing members should sign in; invited members should open their FamOS invitation email to create a password.");
    }
    return data;
  };

  const updatePassword = async (password) => {
    const weak = passwordError(password);
    if (weak) throw new Error(weak);
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
    setPasswordRecovery(false);
  };

  const requestPasswordReset = async (email) => {
    setError(null);
    const { error: resetError } = await supabase.functions.invoke("send-password-email", {
      body: {
        email: email.trim().toLowerCase(),
        purpose: "reset",
        origin: window.location.origin,
      },
    });
    if (resetError) {
      const detail = await getFunctionErrorMessage(resetError);
      throw new Error(detail || "FamOS could not send the reset email right now. Please try again shortly.");
    }
  };

  const requestInvitePasswordCode = async (email) => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const { data: prepareData, error: prepareError } = await supabase.functions.invoke("prepare-invited-account", {
      body: { email: normalizedEmail },
    });
    if (prepareError) {
      const detail = await getFunctionErrorMessage(prepareError);
      throw new Error(detail || "Could not prepare this invited account.");
    }
    if (!prepareData?.invited) {
      throw new Error(prepareData?.existingAccount
        ? "This email already has a FamOS account. Sign in normally or use Forgot? to reset its password."
        : "We could not find an active FamOS invitation for this email.");
    }
    const { error: codeError } = await supabase.functions.invoke("send-password-email", {
      body: {
        email: normalizedEmail,
        purpose: "invitation",
        origin: window.location.origin,
      },
    });
    if (codeError) {
      const detail = await getFunctionErrorMessage(codeError);
      throw new Error(detail || "FamOS could not send the verification code right now. Please try again shortly.");
    }
  };

  const completeInvitePasswordSetup = async (email, token, password) => {
    setError(null);
    const weak = passwordError(password);
    if (weak) throw new Error(weak);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: "email",
    });
    if (verifyError) throw verifyError;
    if (!data.session) throw new Error("That verification code could not start a secure session.");
    const { error: passwordError } = await supabase.auth.updateUser({
      password,
      data: { ...data.user?.user_metadata, invited_to_famos: false },
    });
    if (passwordError) throw passwordError;
    setPasswordRecovery(false);
    await refreshAccount(data.session);
  };

  // Runs the Supabase linkIdentity OAuth dance. Used by signInWithGoogle when
  // there is no google identity yet, and by forceReconnectGoogle when the user
  // asks us to wipe & redo the connection deliberately.
  async function performGoogleOAuthLink({ force = false } = {}) {
    if (force) {
      const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
      if (identitiesError) throw identitiesError;
      const existing = identitiesData?.identities?.find((identity) => identity.provider === "google");
      if (existing) {
        const { error: unlinkError } = await supabase.auth.unlinkIdentity(existing);
        if (unlinkError) throw new Error(`Could not reset the Google connection: ${unlinkError.message}`);
      }
    }
    const { data: oauthData, error: oauthError } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
        skipBrowserRedirect: true,
      },
    });
    if (oauthError) {
      const message = oauthError.message || "";
      if (/manual linking|identity linking/i.test(message)) {
        throw new Error("Google Calendar linking is not enabled yet. Turn on Manual Linking in Supabase Auth settings, then try again.");
      }
      if (/already.*linked|identity.*exists|belongs to another user/i.test(message)) {
        throw new Error("This Google account is already connected to another FamOS login. Disconnect that identity in Supabase Auth, then try again.");
      }
      throw oauthError;
    }
    if (!oauthData?.url) {
      throw new Error("Google did not return a connection page. Check the Google provider and redirect URL in Supabase Auth.");
    }
    window.location.assign(oauthData.url);
  }

  // Connect Google Calendar. Once a Google identity is linked, this is a
  // NO-OP beyond a quick health check against the durable refresh-token table
  // — the OAuth consent screen no longer pops up each time the access token
  // expires. To wipe the identity and re-consent, call `forceReconnectGoogle`
  // explicitly from Settings (when the user taps "Reconnect").
  const signInWithGoogle = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user?.id) {
      throw new Error("Sign in to FamOS before connecting Google Calendar.");
    }

    const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
    if (identitiesError) throw identitiesError;
    const existing = identitiesData?.identities?.find((identity) => identity.provider === "google");
    if (existing) {
      // Identity already linked. Confirm the durable refresh token is still
      // valid in the google-calendar-token edge function. If so, the user is
      // connected — no OAuth round-trip required.
      //
      // If the edge function is not deployed yet or returns an error, the
      // identity is still linked — reuse it rather than redirecting the user
      // to Google OAuth on every sign-in. The Supabase session's provider_token
      // (available for ~1 hour) can still sync the calendar.
      try {
        const status = await invokeEdgeFunction("google-calendar-token", { action: "status" });
        if (status?.connected) {
          return { reused: true, identity: existing };
        }
      } catch {
        // Edge function unreachable / not deployed yet. The identity is still
        // linked — reuse it without OAuth redirect.
      }
      return { reused: true, identity: existing };
    }

    await performGoogleOAuthLink();
  };

  // Hard reconnect — destroys the linked Google identity, then re-runs the
  // OAuth consent flow. Used only when the durable refresh token is gone
  // (Google returned invalid_grant) and the user explicitly opts in.
  const forceReconnectGoogle = async () => {
    await performGoogleOAuthLink({ force: true });
  };

  const signOut = () => supabase?.auth.signOut();

  const deleteAccount = async () => {
    const { error: deleteError } = await supabase.rpc("delete_own_account");
    if (deleteError) throw deleteError;
    localStorage.removeItem("family-os:google-provider-token");
    localStorage.removeItem("family-os:v1");
    localStorage.removeItem("family-os:google:v1");
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setGoogleProviderToken(null);
    setProfile(null);
    setHousehold(null);
    setHouseholdProfile(null);
    setHouseholdProfileExtra(null);
    setMemberProfile(null);
    setSession(null);
  };

  const createHousehold = async (name) => {
    const householdName = name.trim();
    if (!householdName) throw new Error("Household name is required.");
    const { error: createError } = await supabase.rpc("create_household", { household_name: householdName });
    if (createError && !/already belong to a household|already have an invitation/i.test(createError.message || "")) throw createError;
    await refreshAccount(session);
  };

  const saveOwnAvatar = useCallback(async (avatarUrl) => {
    if (!avatarUrl || !session?.user?.id) return;
    const { error: avatarError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", session.user.id);
    if (avatarError) throw avatarError;
    const currentMetadata = session.user.user_metadata || {};
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { ...currentMetadata, avatar_url: avatarUrl },
    });
    if (metadataError) throw metadataError;
  }, [session?.user?.id, session?.user?.user_metadata]);

  const saveHouseholdProfile = async (profileInput = {}) => {
    if (!household?.id || !session?.user?.id) return;
    const completedAt = new Date().toISOString();
    const payload = {
      household_id: household.id,
      family_size: profileInput.familySize,
      adult_count: profileInput.adultCount,
      child_count: profileInput.childCount,
      family_dynamic: profileInput.familyDynamic,
      life_stage: profileInput.lifeStage,
      planning_priorities: profileInput.planningPriorities,
      primary_color: profileInput.primaryColor,
      partner_personalization_opt_in: profileInput.partnerPersonalizationOptIn,
      profile_type: profileInput.profileType || "parent",
      dietary_restrictions: profileInput.dietaryRestrictions || [],
      avoid_ingredients: profileInput.avoidIngredients?.trim() || "",
      meal_notes: profileInput.mealNotes?.trim() || "",
      city: profileInput.city?.trim() || "",
      region: profileInput.region?.trim() || "",
      postal_code: profileInput.postalCode?.trim() || "",
      country: profileInput.country?.trim() || "",
      address: profileInput.address?.trim() || "",
      latitude: profileInput.latitude ?? null,
      longitude: profileInput.longitude ?? null,
      completed_at: completedAt,
    };
    const extraProfile = {
      profileType: profileInput.profileType || "parent",
      dietaryRestrictions: profileInput.dietaryRestrictions || [],
      avoidIngredients: profileInput.avoidIngredients || "",
      mealNotes: profileInput.mealNotes || "",
      city: profileInput.city || "",
      region: profileInput.region || "",
      postalCode: profileInput.postalCode || "",
      country: profileInput.country || "",
      address: profileInput.address || "",
      latitude: profileInput.latitude ?? null,
      longitude: profileInput.longitude ?? null,
      updatedAt: completedAt,
    };
    const memberPayload = { profileType: extraProfile.profileType, calendarPreference: "family", completedAt };
    let { error: profileError } = await supabase
      .from("household_profiles")
      .upsert(payload, { onConflict: "household_id" });
    if (profileError && /profile_type|dietary_restrictions|avoid_ingredients|meal_notes|city|country|address|latitude|longitude|schema cache/i.test(profileError.message || "")) {
      const {
        profile_type: _profileType,
        dietary_restrictions: _dietaryRestrictions,
        avoid_ingredients: _avoidIngredients,
        meal_notes: _mealNotes,
        city: _city,
        region: _region,
        postal_code: _postalCode,
        country: _country,
        address: _address,
        latitude: _latitude,
        longitude: _longitude,
        ...legacyPayload
      } = payload;
      ({ error: profileError } = await supabase.from("household_profiles").upsert(legacyPayload, { onConflict: "household_id" }));
    }
    if (profileError && profileError.code !== "42P01" && !/does not exist|schema cache/i.test(profileError.message || "")) {
      throw profileError;
    }

    const { error: memberProfileError } = await supabase.from("household_member_profiles").upsert({
      household_id: household.id,
      user_id: session.user.id,
      profile_type: memberPayload.profileType,
      calendar_preference: memberPayload.calendarPreference,
      completed_at: completedAt,
    }, { onConflict: "household_id,user_id" });
    if (memberProfileError && memberProfileError.code !== "42P01" && !/does not exist|schema cache/i.test(memberProfileError.message || "")) {
      throw memberProfileError;
    }

    localStorage.setItem(onboardingProfileKey(household.id, session.user.id), "true");
    localStorage.setItem(householdProfileExtraKey(household.id), JSON.stringify(extraProfile));
    localStorage.setItem(memberProfileKey(household.id, session.user.id), JSON.stringify(memberPayload));
    setHouseholdProfile(payload);
    setHouseholdProfileExtra(extraProfile);
    setMemberProfile(memberPayload);
    await saveOwnAvatar(profileInput.avatarUrl);
    await importStapleGroceries(profileInput.groceryImportText, household.id, session.user.id);
    await refreshAccount(session);
  };

  const updateHouseholdSettings = useCallback(async (input = {}) => {
    if (!household?.id || !session?.user?.id) return;
    if (household.role !== "owner") throw new Error("Only a household admin can change shared household details.");
    const nextName = input.name?.trim();
    if (!nextName) throw new Error("Household name is required.");

    const { error: householdError } = await supabase.from("households").update({ name: nextName }).eq("id", household.id);
    if (householdError) throw householdError;

    const profilePatch = {
      household_id: household.id,
      dietary_restrictions: input.dietaryRestrictions || [],
      avoid_ingredients: input.avoidIngredients?.trim() || "",
      city: input.city?.trim() || "",
      region: input.region?.trim() || "",
      postal_code: input.postalCode?.trim() || "",
      country: input.country?.trim() || "",
      address: input.address?.trim() || "",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    };
    const { error: profileError } = await supabase.from("household_profiles").upsert(profilePatch, { onConflict: "household_id" });
    if (profileError) throw profileError;
    setHousehold((current) => current ? { ...current, name: nextName } : current);
    setHouseholdProfile((current) => ({ ...(current || {}), ...profilePatch }));
    setHouseholdProfileExtra((current) => ({
      ...(current || {}),
      dietaryRestrictions: profilePatch.dietary_restrictions,
      avoidIngredients: profilePatch.avoid_ingredients,
      city: profilePatch.city,
      region: profilePatch.region,
      postalCode: profilePatch.postal_code,
      country: profilePatch.country,
      address: profilePatch.address,
      latitude: profilePatch.latitude,
      longitude: profilePatch.longitude,
      updatedAt: new Date().toISOString(),
    }));
  }, [household?.id, household?.role, session?.user?.id]);

  // Shared home location & dietary preferences are usable by any household
  // member (the owner-only path also renames the household). This lets a
  // parent/guardian who isn't the master owner still add the home address.
  const updateHouseholdProfile = useCallback(async (input = {}) => {
    if (!household?.id || !session?.user?.id) return;
    const profilePatch = {
      household_id: household.id,
      dietary_restrictions: input.dietaryRestrictions || [],
      avoid_ingredients: input.avoidIngredients?.trim() || "",
      city: input.city?.trim() || "",
      region: input.region?.trim() || "",
      postal_code: input.postalCode?.trim() || "",
      country: input.country?.trim() || "",
      address: input.address?.trim() || "",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    };
    const { error: profileError } = await supabase.from("household_profiles").upsert(profilePatch, { onConflict: "household_id" });
    if (profileError) throw profileError;
    setHouseholdProfile((current) => ({ ...(current || {}), ...profilePatch }));
    setHouseholdProfileExtra((current) => ({
      ...(current || {}),
      dietaryRestrictions: profilePatch.dietary_restrictions,
      avoidIngredients: profilePatch.avoid_ingredients,
      city: profilePatch.city,
      region: profilePatch.region,
      postalCode: profilePatch.postal_code,
      country: profilePatch.country,
      address: profilePatch.address,
      latitude: profilePatch.latitude,
      longitude: profilePatch.longitude,
      updatedAt: new Date().toISOString(),
    }));
  }, [household?.id, session?.user?.id]);

  const saveMemberProfile = useCallback(async (profileInput = {}) => {
    if (!household?.id || !session?.user?.id) return;
    const completedAt = new Date().toISOString();
    const payload = {
      profileType: profileInput.profileType || "parent",
      calendarPreference: profileInput.calendarPreference || "family",
      completedAt,
    };
    const { error: memberProfileError } = await supabase.from("household_member_profiles").upsert({
      household_id: household.id,
      user_id: session.user.id,
      profile_type: payload.profileType,
      calendar_preference: payload.calendarPreference,
      completed_at: payload.completedAt,
    }, { onConflict: "household_id,user_id" });
    if (memberProfileError && memberProfileError.code !== "42P01" && !/does not exist|schema cache/i.test(memberProfileError.message || "")) {
      throw memberProfileError;
    }
    localStorage.setItem(memberProfileKey(household.id, session.user.id), JSON.stringify(payload));
    setMemberProfile(payload);
    await saveOwnAvatar(profileInput.avatarUrl);
    setOnboardingRequired(false);
  }, [household?.id, session?.user?.id, saveOwnAvatar]);

  const acceptInvitation = async () => {
    if (!invitation) return;
    const { error: acceptError } = await supabase.rpc("accept_household_invitation", { invitation_id: invitation.id });
    if (acceptError) throw acceptError;
    await refreshAccount(session);
  };

  const updateDeliveryChannel = useCallback(async (channel) => {
    const normalized = String(channel || "").toLowerCase().trim();
    if (!["email", "sms", "both"].includes(normalized)) {
      throw new Error("Pick Email, SMS, or Both as your delivery channel.");
    }
    if (!session?.user?.id) return normalized;
    // Snapshot previous value at call-start so two rapid clicks each roll
    // back to their own pre-call value, not both to a stale closure capture.
    const previous = memberDeliveryChannel;
    // Optimistic — flip local state immediately so the UI picker reflects
    // the choice without waiting for the round-trip.
    setMemberDeliveryChannel(normalized);
    try {
      const { error } = await supabase.rpc("set_own_delivery_channel", { channel: normalized });
      if (error && error.code !== "PGRST202" && !/does not exist|schema cache/i.test(error.message || "")) {
        throw error;
      }
    } catch (error) {
      setMemberDeliveryChannel(previous);
      throw error;
    }
    return normalized;
  }, [session?.user?.id, memberDeliveryChannel]);

  const invitePartner = async (email, phone = "", name = "", deliveryChannel = "") => {
    const normalizedEmail = email.trim().toLowerCase();
    const resolvedChannel = String(deliveryChannel || memberDeliveryChannel || "both").toLowerCase();
    let inviteData = null;
    let inviteError = null;
    try {
      inviteData = await invokeEdgeFunction("send-family-invitation", {
        email: normalizedEmail,
        phone: phone.trim(),
        name: name.trim(),
        delivery_channel: resolvedChannel,
        householdId: household.id,
        redirectTo: `${window.location.origin}/signin?invite=1`,
      });
    } catch (error) {
      inviteError = error instanceof Error
        ? error
        : new Error(`Invitation request failed: ${JSON.stringify(error) || String(error)}`);
    }
    if (!inviteError) {
      const sent = Boolean(inviteData?.sent);
      const provider = inviteData?.provider;
      const providerName = provider === "resend" ? "FamOS email"
        : provider === "aws_ses" ? "Amazon SES"
        : provider === "supabase_fallback" ? "Supabase (fallback)"
        : provider === "supabase" ? "Supabase"
        : null;
      const status = inviteData?.emailStatus;
      const sms = inviteData?.sms || null;

      // New structured delivery status — branches on emailStatus rather than
      // concatenating raw emailProvider / SESError text. The legacy strings
      // remain as the fallback for any unsigned pre-migration toolchain.
      let message;
      if (status === "delivered" || status === "supabase_fallback_delivered") {
        const prefix = providerName ? `Invitation email delivered through ${providerName}.` : "Invitation email delivered.";
        message = sms?.sent
          ? `${prefix} SMS invitation sent too. You’ll remain listed as Pending until they join.`
          : `${prefix} They’ll remain listed as Pending until they join.`;
      } else if (status === "sandbox_blocked") {
        message = sms?.sent
          ? "Invitation sent to your family member by SMS — the email is paused while AWS reviews production access for this app, so the SMS is doing the work for now."
          : "Invitation saved. Branded email delivery is paused while AWS reviews this app’s production email access — your invitee will show as a pending row in your household until email is re-enabled.";
      } else if (status === "rate_limited") {
        message = sms?.sent
          ? "Invitation saved. Supabase’s invite email is rate-limited for ~60 seconds — SMS invitation sent successfully and you can resend the email after that window."
          : "Invitation saved. Supabase’s invite email is rate-limited for the next ~60 seconds. Try resending after that window.";
      } else if (status === "no_email_provider") {
        message = sms?.sent
          ? "Invitation saved, but the email provider isn’t fully configured yet — SMS invitation sent successfully."
          : "Invitation saved, but no email provider is currently accepting invites for this household.";
      } else if (sent) {
        message = `Invitation email sent${providerName ? ` through ${providerName}` : ""}.${sms?.sent ? " SMS invitation sent too." : sms?.requested ? ` SMS was not sent: ${sms.message || "provider unavailable"}.` : ""} You’ll remain listed as Pending until they join.`;
      } else if (inviteData?.existingAccount) {
        message = "Invitation saved. They already have a FamOS login and will see this home when they sign in.";
      } else {
        message = `Invitation saved, but email was not sent: ${inviteData?.emailError || "the email provider did not confirm delivery"}.${sms?.sent ? " SMS invitation sent successfully." : sms?.requested ? ` SMS was not sent: ${sms.message || "provider unavailable"}.` : ""}`;
      }

      return {
        sent,
        pending: true,
        emailStatus: inviteData?.emailStatus || null,
        emailErrorKind: inviteData?.emailErrorKind || null,
        provider,
        sms,
        deliveryChannel: inviteData?.deliveryChannel || resolvedChannel,
        message,
      };
    }

    const emailServiceMessage = inviteError instanceof Error && inviteError.message
      ? inviteError.message
      : await getFunctionErrorMessage(inviteError);
    const pendingInvitePayload = {
      household_id: household.id,
      email: normalizedEmail,
      ...(name.trim() ? { invited_name: name.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      invited_by: session.user.id,
    };
    let pendingInviteResult = await supabase.from("household_invitations").insert(pendingInvitePayload);
    if (pendingInviteResult.error && /invited_name|phone|schema cache|column/i.test(pendingInviteResult.error.message || "")) {
      pendingInviteResult = await supabase.from("household_invitations").insert({
        household_id: household.id,
        email: normalizedEmail,
        invited_by: session.user.id,
      });
    }

    if (pendingInviteResult.error?.code === "23505") {
      const { data: existingInvite } = await supabase
        .from("household_invitations")
        .select("id, accepted_at, expires_at")
        .eq("household_id", household.id)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingInvite?.accepted_at) {
        return {
          sent: false,
          pending: false,
          message: "That family member has already accepted an invitation to this home.",
        };
      }

      const inviteIsActive = existingInvite?.expires_at && new Date(existingInvite.expires_at) > new Date();
      if (existingInvite?.id && inviteIsActive) {
        pendingInviteResult = { error: null };
      } else if (existingInvite?.id) {
        const { error: deleteInviteError } = await supabase.from("household_invitations").delete().eq("id", existingInvite.id);
        if (!deleteInviteError) {
          pendingInviteResult = await supabase.from("household_invitations").insert(pendingInvitePayload);
          if (pendingInviteResult.error && /invited_name|phone|schema cache|column/i.test(pendingInviteResult.error.message || "")) {
            pendingInviteResult = await supabase.from("household_invitations").insert({
              household_id: household.id,
              email: normalizedEmail,
              invited_by: session.user.id,
            });
          }
        }
      }
    }

    if (pendingInviteResult.error) {
      throw new Error(emailServiceMessage);
    }

    return {
      sent: false,
      pending: true,
      deliveryChannel: resolvedChannel,
      message: `Invite saved, but delivery failed: ${emailServiceMessage}`,
    };
  };

  const skipOnboardingInvites = useCallback(() => {
    if (household?.id && session?.user?.id) {
      localStorage.setItem(onboardingSkipKey(household.id, session.user.id), "true");
    }
    setOnboardingRequired(false);
  }, [household?.id, session?.user?.id]);

  // Escape hatch for owners whose household is already set up and who don't
  // want to walk through the full OwnerProfileStep wizard on the next login.
  // Sets the SAME localStorage key `saveHouseholdProfile` sets — the gate
  // short-circuits on this on the next refreshAccount() even if the user is
  // offline or the server write later fails. The server `completed_at` bump
  // is best-effort so other devices see the same flag without local state.
  const markOnboardingComplete = useCallback(() => {
    if (!household?.id || !session?.user?.id) return;
    try {
      localStorage.setItem(onboardingProfileKey(household.id, session.user.id), "true");
    } catch {
      /* localStorage disabled — silently no-op; activity inference can still rescue the user */
    }
    const completedAt = new Date().toISOString();
    supabase
      .from("household_profiles")
      .update({ completed_at: completedAt })
      .eq("household_id", household.id)
      .then(({ error }) => {
        if (!error) setHouseholdProfile((current) => ({ ...(current || {}), completed_at: completedAt }));
      });
    setOnboardingRequired(false);
  }, [household?.id, session?.user?.id]);

  const value = {
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    household,
    householdProfile,
    householdProfileExtra,
    memberProfile,
    invitation,
    loading,
    error,
    passwordRecovery,
    onboardingRequired,
    signIn,
    signUp,
    updatePassword,
    requestPasswordReset,
    requestInvitePasswordCode,
    completeInvitePasswordSetup,
    signInWithGoogle,
    forceReconnectGoogle,
    googleProviderToken,
    signOut,
    deleteAccount,
    createHousehold,
    saveHouseholdProfile,
    updateHouseholdSettings,
    updateHouseholdProfile,
    saveMemberProfile,
    acceptInvitation,
    invitePartner,
    skipOnboardingInvites,
    markOnboardingComplete,
    refreshAccount,
    memberDeliveryChannel,
    updateDeliveryChannel,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
