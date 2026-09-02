import Spinner from "@/components/Spinner";

/**
 * Shared loading and failure states for the signed-in screens.
 *
 * Errors say what happened and how to fix it in the interface's voice — a
 * paper trader seeing a blank panel needs to know whether their positions are
 * gone or the API is simply down.
 */
export function Loading({ label = "Loading" }) {
  return (
    <div className="grid place-items-center py-16 text-muted-foreground">
      <Spinner className="size-5" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Failed({ error, onRetry }) {
  const offline = error?.status === undefined || error?.status >= 500;

  return (
    <div className="px-5 py-14 text-center">
      <p className="text-sm text-foreground">
        {offline ? "Can't reach the Orbit API" : error.message}
      </p>
      <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
        {offline
          ? "Your positions are safe — this screen just can't load them right now. Check the API is running, then try again."
          : "Nothing was changed."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full border border-line px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Try again
        </button>
      )}
    </div>
  );
}
