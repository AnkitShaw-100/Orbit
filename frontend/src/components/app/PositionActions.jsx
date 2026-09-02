/**
 * The two things you can do to an open position, wherever it is listed.
 *
 * Both carry their own colour rather than waiting for a hover to earn one: a
 * neutral outline in a row of neutral text is furniture, and the whole point
 * of putting these next to a position is that you can see the exit.
 *
 * Closing wipes a position, so it asks once — the same two-step the settings
 * danger zone uses. The armed state belongs to the parent rather than to this
 * component: a page shows several positions at once and only one of them may
 * be mid-confirmation, which is a fact about the list, not about a button.
 */
export default function PositionActions({
  armed,
  pending = false,
  /** Seconds the order limiter is still refusing for; 0 when it isn't. */
  cooldown = 0,
  onAdd,
  onArm,
  onCancel,
  onConfirm,
}) {
  const base =
    "rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none";

  if (armed) {
    return (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || cooldown > 0}
          className={`${base} bg-loss text-on-loss hover:brightness-110 disabled:opacity-60`}
        >
          {pending ? "Closing…" : cooldown > 0 ? `Wait ${cooldown}s` : "Confirm close"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${base} border border-line font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground`}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onAdd}
        className={`${base} border border-gain/40 bg-gain/10 text-gain hover:bg-gain/20`}
      >
        Add
      </button>
      <button
        type="button"
        onClick={onArm}
        className={`${base} border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20`}
      >
        Close
      </button>
    </div>
  );
}
