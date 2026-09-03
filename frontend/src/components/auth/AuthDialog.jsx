import { useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { X } from "lucide-react";
import OrbitMark from "@/components/OrbitMark";
import Spinner from "@/components/Spinner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/authContext";
import { celebrate } from "@/lib/celebrate";
import { markWelcome } from "@/lib/welcome";

/**
 * Signing in without leaving the page.
 *
 * /login and /signup stay real routes — an email confirmation link, a bookmark
 * and RequireAuth's redirect all have to land somewhere — but they open as a
 * card over whatever you were reading instead of replacing it. Someone halfway
 * down the markets table should not lose their place to type a password.
 */
const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Pick up where your last trade left off.",
    action: "Sign in",
    busy: "Signing in…",
    prompt: "New here?",
    linkLabel: "Create an account",
    linkTo: "/signup",
  },
  signup: {
    title: "Open your account",
    subtitle: "No card, no deposit. Your wallet is funded with $100,000 the moment you sign up.",
    action: "Create account",
    busy: "Creating account…",
    prompt: "Already have an account?",
    linkLabel: "Sign in",
    linkTo: "/login",
  },
};

function Field({ label, type = "text", name, placeholder, autoComplete, hint, minLength }) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        required
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={hint ? hintId : undefined}
        className="mt-2 w-full rounded-xl border border-line bg-void px-4 py-3 text-sm text-foreground transition-colors placeholder:text-faint hover:border-foreground/20 focus:border-brand/60 focus:ring-2 focus:ring-brand/40 focus:outline-none"
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-[11px] text-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Both outcomes of submitting, in one shape. `role="alert"` because someone
 * using a screen reader has just pressed a button and has no other way to
 * learn what happened — the message renders below the control they left.
 */
function Message({ tone = "loss", children }) {
  const palette =
    tone === "gain" ? "border-gain/40 bg-gain/10 text-gain" : "border-loss/40 bg-loss/10 text-loss";

  return (
    <p role="alert" className={`rounded-xl border px-4 py-3 text-xs ${palette}`}>
      {children}
    </p>
  );
}

export default function AuthDialog({ mode }) {
  const copy = COPY[mode];
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // Where the visitor was before the card opened, and where they were headed
  // when RequireAuth sent them here.
  const background = location.state?.background;
  const destination = location.state?.from ?? "/dashboard";

  const close = () => navigate(background ? -1 : "/");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const password = form.get("password");

    const { data, error: authError } =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, form.get("name"));

    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // The account exists now, whether or not a session came back with it.
    if (mode === "signup") {
      celebrate();
      // Read by AppShell on the first signed-in screen this tab reaches. Set
      // here rather than passed through navigation state, which a redirect
      // through /login would drop — see lib/welcome.js.
      markWelcome();
    }

    // With email confirmation on, Supabase returns a user but no session.
    if (mode === "signup" && !data.session) {
      setNotice("Welcome to Orbit! Check your inbox to confirm your address, then sign in.");
      return;
    }

    navigate(destination, { replace: true });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        className="page max-w-[calc(100%-2rem)] gap-0 rounded-2xl border border-line bg-panel p-7 text-center ring-0 sm:max-w-[25rem]"
      >
        {/* Escape and the backdrop already close this, but neither is visible.
            A card with no way out that you can see reads as a wall, especially
            to someone who only wanted to look around before signing up. */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        {/* The same lockup the navbar carries, so the card reads as Orbit's
            even though it covers the page the navbar is on. */}
        <div className="flex items-center justify-center gap-2">
          <OrbitMark className="size-7 shrink-0 text-brand" />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Orbit
          </span>
        </div>

        <DialogTitle className="mt-5 font-display text-2xl leading-tight font-bold tracking-[-0.03em] text-foreground">
          {copy.title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {copy.subtitle}
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left">
          {mode === "signup" && (
            <Field label="Name" name="name" placeholder="Ankit" autoComplete="name" />
          )}

          <Field
            label="Email"
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            name="password"
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            hint={mode === "signup" ? "At least 8 characters." : undefined}
          />

          {error && <Message>{error}</Message>}
          {notice && <Message tone="gain">{notice}</Message>}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Spinner />}
            {busy ? copy.busy : copy.action}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          {copy.prompt}{" "}
          <Link
            to={copy.linkTo}
            replace
            state={location.state}
            className="text-foreground underline underline-offset-4"
          >
            {copy.linkLabel}
          </Link>
        </p>

        {mode === "signup" && (
          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            Orbit is a simulator. It never holds funds, never asks for a card, and cannot place an
            order on a real exchange.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
