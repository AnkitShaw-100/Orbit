import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import AuthLayout, { Field } from "./AuthLayout";
import { useAuth } from "@/context/authContext";

export default function Signup() {
  const { signUp, session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const { data, error: authError } = await signUp(
      form.get("email"),
      form.get("password"),
      form.get("name"),
    );

    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    // With email confirmation on, Supabase returns a user but no session.
    if (!data.session) {
      setNotice("Check your inbox to confirm your address, then sign in.");
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthLayout
      title="Open your account"
      subtitle="No card, no deposit. Your wallet is funded with $100,000 in virtual cash the moment you sign up."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Name" name="name" placeholder="Aryan" autoComplete="name" />
        <Field label="Email" type="email" name="email" placeholder="you@example.com" autoComplete="email" />
        <Field
          label="Password"
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="new-password"
          hint="At least 8 characters."
        />

        {error && (
          <p className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs text-loss">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl border border-gain/40 bg-gain/10 px-4 py-3 text-xs text-gain">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p className="text-[11px] leading-relaxed text-faint">
          Orbit is a simulator. It never holds funds, never asks for a card, and
          cannot place an order on a real exchange.
        </p>
      </form>
    </AuthLayout>
  );
}
