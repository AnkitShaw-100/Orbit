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
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
