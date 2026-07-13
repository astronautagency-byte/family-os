import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [household, setHousehold] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [googleProviderToken, setGoogleProviderToken] = useState(() => localStorage.getItem("family-os:google-provider-token"));

  const refreshAccount = useCallback(async (nextSession) => {
    if (!supabase || !nextSession?.user) {
      setProfile(null);
      setHousehold(null);
      setInvitation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [{ data: profileData, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", nextSession.user.id).single(),
        supabase.from("household_members").select("household_id, role, households(id, name)").eq("user_id", nextSession.user.id).maybeSingle(),
      ]);
      if (profileError) throw profileError;
      if (membershipError) throw membershipError;
      setProfile(profileData);
      setHousehold(membership ? { ...membership.households, role: membership.role } : null);

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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

  const signUp = async (email, password) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
    });
    if (signUpError) throw signUpError;
    return data;
  };

  const updatePassword = async (password) => {
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
  };

  const signInWithGoogle = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (oauthError) throw oauthError;
  };

  const signOut = () => supabase?.auth.signOut();

  const createHousehold = async (name) => {
    const { error: createError } = await supabase.rpc("create_household", { household_name: name });
    if (createError) throw createError;
    await refreshAccount(session);
  };

  const acceptInvitation = async () => {
    if (!invitation) return;
    const { error: acceptError } = await supabase.rpc("accept_household_invitation", { invitation_id: invitation.id });
    if (acceptError) throw acceptError;
    await refreshAccount(session);
  };

  const invitePartner = async (email) => {
    const { error: inviteError } = await supabase.from("household_invitations").upsert({
      household_id: household.id,
      email: email.trim().toLowerCase(),
      invited_by: session.user.id,
      accepted_at: null,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }, { onConflict: "household_id,email" });
    if (inviteError) throw inviteError;
  };

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    household,
    invitation,
    loading,
    error,
    signIn,
    signUp,
    updatePassword,
    signInWithGoogle,
    googleProviderToken,
    signOut,
    createHousehold,
    acceptInvitation,
    invitePartner,
    refreshAccount,
  }), [session, profile, household, invitation, loading, error, refreshAccount, googleProviderToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
