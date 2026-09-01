import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Starts true so guards wait for the stored session to load instead of
  // bouncing a signed-in user to the login page on every refresh.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password, name) =>
        supabase.auth.signUp({ email, password, options: { data: { name } } }),
      /**
       * Google hands the browser back to `destination` with the session in the
       * URL, which the client picks up on its own (detectSessionInUrl). The
       * path has to be on Supabase's redirect allow list or the provider
       * refuses it, so this builds an absolute URL from the current origin
       * rather than trusting a configured one.
       */
      signInWithGoogle: (destination = "/dashboard") =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}${destination}` },
        }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
