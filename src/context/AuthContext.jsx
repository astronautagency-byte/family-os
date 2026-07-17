import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

function onboardingSkipKey(householdId, userId) {
  return `family-os:onboarding-invites-skipped:${householdId}:${userId}`;
}

function onboardingProfileKey(householdId, userId) {
  return `family-os:onboarding-profile-complete:${householdId}:${userId}`;
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

function isMissingRpc(error) {
  return error?.code === "42883" || /could not find the function|schema cache/i.test(error?.message || "");
}

async function reconcileExistingHouseholdInvitations(householdId) {
  if (!supabase || !householdId) return;
  const { error } = await supabase.rpc("reconcile_existing_household_invitations", { target_household: householdId });
  if (error && !isMissingRpc(error)) console.warn("Could not reconcile existing household invitations.", error);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [household, setHousehold] = useState(null);
  const [householdProfile, setHouseholdProfile] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [googleProviderToken, setGoogleProviderToken] = useState(() => localStorage.getItem("family-os:google-provider-token"));

  const refreshAccount = useCallback(async (nextSession) => {
    if (!supabase || !nextSession?.user) {
      setProfile(null);
      setHousehold(null);
      setHouseholdProfile(null);
      setInvitation(null);
      setLoading(false);
      setOnboardingRequired(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
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
      if (!membership) {
        const { data: acceptedHouseholdId, error: claimError } = await supabase.rpc("accept_matching_household_invitation");
        if (claimError && !isMissingRpc(claimError)) throw claimError;
        if (acceptedHouseholdId) {
          const { data: claimedMembership, error: claimedMembershipError } = await supabase
            .from("household_members")
            .select("household_id, role")
            .eq("user_id", nextSession.user.id)
            .limit(1)
            .maybeSingle();
          if (claimedMembershipError) throw claimedMembershipError;
          membership = claimedMembership;
        }
      }
      let householdData = null;
      let householdProfileData = null;
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
      if (googleAvatar && Object.hasOwn(accountProfile, "avatar_url") && !accountProfile.avatar_url) {
        profilePatch.avatar_url = googleAvatar;
      }
      if (profileData && Object.keys(profilePatch).length) {
        const { error: profileUpdateError } = await supabase.from("profiles").update(profilePatch).eq("id", nextSession.user.id);
        if (!profileUpdateError) Object.assign(accountProfile, profilePatch);
      }
      setProfile(accountProfile);
      setHousehold(membership && householdData ? { ...householdData, role: membership.role } : null);
      setHouseholdProfile(householdProfileData);

      if (membership?.role === "owner") {
        const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
          supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", membership.household_id),
          supabase.from("household_invitations").select("id", { count: "exact", head: true }).eq("household_id", membership.household_id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
        ]);
        const skippedInvites = localStorage.getItem(onboardingSkipKey(membership.household_id, nextSession.user.id)) === "true";
        const localProfileComplete = localStorage.getItem(onboardingProfileKey(membership.household_id, nextSession.user.id)) === "true";
        const profileComplete = Boolean(householdProfileData?.completed_at) || localProfileComplete;
        const hasFinishedInitialSetup = profileComplete || skippedInvites || (memberCount || 0) >= 2 || (inviteCount || 0) > 0;
        setOnboardingRequired(!hasFinishedInitialSetup);
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
    if (!supabase) return;
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
      email: email.trim().toLowerCase(), password,
    });
    if (signInError) throw signInError;
  };

  const signUp = async (email, password, displayName) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (signUpError) throw signUpError;
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
    if (resetError) throw resetError;
  };

  const signInWithGoogle = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (oauthError) throw oauthError;
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
    setSession(null);
  };

  const createHousehold = async (name) => {
    const { error: createError } = await supabase.rpc("create_household", { household_name: name });
    if (createError && !/already belong to a household/i.test(createError.message || "")) throw createError;
    await refreshAccount(session);
  };

  const saveHouseholdProfile = async (profileInput) => {
    if (!household?.id || !session?.user?.id) return;
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
      completed_at: new Date().toISOString(),
    };
    localStorage.setItem(onboardingProfileKey(household.id, session.user.id), "true");
    setHouseholdProfile(payload);
    const { error: profileError } = await supabase
      .from("household_profiles")
      .upsert(payload, { onConflict: "household_id" });
    if (profileError && profileError.code !== "42P01" && !/does not exist|schema cache/i.test(profileError.message || "")) {
      throw profileError;
    }
    await refreshAccount(session);
  };

  const acceptInvitation = async () => {
    if (!invitation) return;
    const { error: acceptError } = await supabase.rpc("accept_household_invitation", { invitation_id: invitation.id });
    if (acceptError) throw acceptError;
    await refreshAccount(session);
  };

  const invitePartner = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error: inviteError } = await supabase.functions.invoke("send-family-invitation", {
      body: { email: normalizedEmail, householdId: household.id, redirectTo: window.location.origin },
    });
    if (!inviteError) {
      await reconcileExistingHouseholdInvitations(household.id);
      await refreshAccount(session);
      return { sent: true, message: "Invitation email sent." };
    }

    const emailServiceMessage = await getFunctionErrorMessage(inviteError);
    let pendingInviteResult = await supabase.from("household_invitations").insert({
      household_id: household.id,
      email: normalizedEmail,
      invited_by: session.user.id,
    });

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
          pendingInviteResult = await supabase.from("household_invitations").insert({
            household_id: household.id,
            email: normalizedEmail,
            invited_by: session.user.id,
          });
        }
      }
    }

    if (pendingInviteResult.error) {
      throw new Error(emailServiceMessage);
    }

    await reconcileExistingHouseholdInvitations(household.id);
    await refreshAccount(session);
    return {
      sent: false,
      pending: true,
      message:
        "Invite saved, but the email service is not reachable yet. Deploy/configure the Supabase send-family-invitation Edge Function to send invitation emails.",
    };
  };

  const skipOnboardingInvites = useCallback(() => {
    if (household?.id && session?.user?.id) {
      localStorage.setItem(onboardingSkipKey(household.id, session.user.id), "true");
    }
    setOnboardingRequired(false);
  }, [household?.id, session?.user?.id]);

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    household,
    householdProfile,
    invitation,
    loading,
    error,
    passwordRecovery,
    onboardingRequired,
    signIn,
    signUp,
    updatePassword,
    requestPasswordReset,
    signInWithGoogle,
    googleProviderToken,
    signOut,
    deleteAccount,
    createHousehold,
    saveHouseholdProfile,
    acceptInvitation,
    invitePartner,
    skipOnboardingInvites,
    refreshAccount,
  }), [session, profile, household, householdProfile, invitation, loading, error, passwordRecovery, onboardingRequired, refreshAccount, googleProviderToken, skipOnboardingInvites]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
