import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

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
  try {
    const response = functionError?.context;
    if (response?.clone) {
      const payload = await response.clone().json();
      if (payload?.error) return payload.error;
    }
  } catch {
    // FunctionFetchError does not always include a parseable response.
  }
  return functionError?.message || "Could not reach the invitation email service.";
}

function getAuthErrorMessage(authError, fallback) {
  const candidates = [
    authError?.message,
    authError?.error_description,
    authError?.error,
    authError?.cause?.message,
    authError?.context?.message,
  ];
  const message = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (!message || message === "{}" || message === "[object Object]") return fallback;
  if (/error sending (recovery|magic link|email)|unexpected_failure/i.test(message)) {
    return "FamOS could not send the email right now. Please try again shortly.";
  }
  return message;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [household, setHousehold] = useState(null);
  const [householdProfile, setHouseholdProfile] = useState(null);
  const [householdProfileExtra, setHouseholdProfileExtra] = useState(null);
  const [memberProfile, setMemberProfile] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
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
      setInvitation(null);
      setLoading(false);
      setOnboardingRequired(false);
      return;
    }

    setLoading(true);
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
        supabase.from("household_members").select("household_id, role").eq("user_id", nextSession.user.id).order("joined_at", { ascending: true }).limit(1).maybeSingle(),
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

      let householdData = null;
      let householdProfileData = null;
      let householdProfileExtraData = null;
      let localMemberProfile = null;

      if (membership?.household_id) {
        const { data, error: householdError } = await supabase.from("households").select("id, name").eq("id", membership.household_id).maybeSingle();
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
      setHousehold(membership && householdData ? { ...householdData, role: membership.role } : null);
      setHouseholdProfile(householdProfileData);
      setHouseholdProfileExtra(householdProfileExtraData);
      setMemberProfile(localMemberProfile);

      if (membership?.role === "owner") {
        const localProfileComplete = localStorage.getItem(onboardingProfileKey(membership.household_id, nextSession.user.id)) === "true";
        const profileComplete = Boolean(householdProfileData?.completed_at) || localProfileComplete;
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
      }
    } catch (e) {
      setError(e.message || "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.provider_token) {
        localStorage.setItem("family-os:google-provider-token", data.session.provider_token);
        setGoogleProviderToken(data.session.provider_token);
      }
      refreshAccount(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(nextSession);
      if (nextSession?.provider_token) {
        localStorage.setItem("family-os:google-provider-token", nextSession.provider_token);
        setGoogleProviderToken(nextSession.provider_token);
      }
      if (!nextSession) {
        localStorage.removeItem("family-os:google-provider-token");
        setGoogleProviderToken(null);
      }
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
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
    setPasswordRecovery(false);
  };

  const requestPasswordReset = async (email) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (resetError) {
      throw new Error(getAuthErrorMessage(resetError, "FamOS could not send the reset email right now. Please try again shortly."));
    }
  };

  const requestInvitePasswordCode = async (email) => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const { error: prepareError } = await supabase.functions.invoke("prepare-invited-account", {
      body: { email: normalizedEmail },
    });
    if (prepareError) {
      const detail = await getFunctionErrorMessage(prepareError);
      throw new Error(detail || "Could not prepare this invited account.");
    }
    const { error: codeError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    });
    if (codeError) {
      throw new Error(getAuthErrorMessage(codeError, "FamOS could not send the invitation code right now. Please try again shortly."));
    }
  };

  const completeInvitePasswordSetup = async (email, token, password) => {
    setError(null);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: "email",
    });
    if (verifyError) throw verifyError;
    if (!data.session) throw new Error("That verification code could not start a secure session.");
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
    setPasswordRecovery(false);
    await refreshAccount(data.session);
  };

  const signInWithGoogle = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user?.id) {
      throw new Error("Sign in to FamOS before connecting Google Calendar.");
    }

    // Google is a calendar connection here, not a second FamOS login. Provider
    // access tokens expire and Supabase intentionally does not refresh them, so
    // an existing Google identity is unlinked before reconnecting. The user's
    // email/password identity and household membership remain untouched.
    const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
    if (identitiesError) throw identitiesError;
    const existingGoogleIdentity = identitiesData?.identities?.find((identity) => identity.provider === "google");
    if (existingGoogleIdentity) {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(existingGoogleIdentity);
      if (unlinkError) throw new Error(`Could not refresh the Google connection: ${unlinkError.message}`);
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
      country: profilePatch.country,
      address: profilePatch.address,
      latitude: profilePatch.latitude,
      longitude: profilePatch.longitude,
      updatedAt: new Date().toISOString(),
    }));
  }, [household?.id, household?.role, session?.user?.id]);

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

  const invitePartner = async (email, phone = "", name = "") => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: inviteData, error: inviteError } = await supabase.functions.invoke("send-family-invitation", {
      body: { email: normalizedEmail, phone: phone.trim(), name: name.trim(), householdId: household.id, redirectTo: `${window.location.origin}/signin?invite=1` },
    });
    if (!inviteError) {
      const sent = Boolean(inviteData?.sent);
      return {
        sent,
        pending: true,
        sms: inviteData?.sms || null,
        message: sent
          ? `Invitation email sent${inviteData?.provider ? ` through ${inviteData.provider === "resend" ? "FamOS email" : "Supabase"}` : ""}.${inviteData?.sms?.sent ? " SMS invitation sent too." : inviteData?.sms?.requested ? ` SMS was not sent: ${inviteData.sms.message || "provider unavailable"}.` : ""} They’ll remain listed as Pending until they join.`
          : inviteData?.existingAccount
            ? "Invitation saved. They already have a FamOS login and will see this home when they sign in."
            : "Invitation saved, but the email provider did not confirm delivery.",
      };
    }

    const emailServiceMessage = await getFunctionErrorMessage(inviteError);
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
      message: `Invite saved, but delivery failed: ${emailServiceMessage}`,
    };
  };

  const skipOnboardingInvites = useCallback(() => {
    if (household?.id && session?.user?.id) {
      localStorage.setItem(onboardingSkipKey(household.id, session.user.id), "true");
    }
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
    googleProviderToken,
    signOut,
    deleteAccount,
    createHousehold,
    saveHouseholdProfile,
    updateHouseholdSettings,
    saveMemberProfile,
    acceptInvitation,
    invitePartner,
    skipOnboardingInvites,
    refreshAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
