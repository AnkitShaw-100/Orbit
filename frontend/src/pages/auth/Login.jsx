import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import AuthLayout, { Field } from "./AuthLayout";
import { useAuth } from "@/context/authContext";

export default function Login() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — go straight through rather than showing the form.
  if (!loading && session) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const { error: authError } = await signIn(form.get("email"), form.get("password"));

    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    navigate(location.state?.from ?? "/dashboard", { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Pick up where your last trade left off."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="text-white underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email" type="email" name="email" placeholder="you@example.com" autoComplete="email" />
        <Field label="Password" type="password" name="password" placeholder="••••••••" autoComplete="current-password" />

        {error && (
          <p className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs text-loss">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-white py-3.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
