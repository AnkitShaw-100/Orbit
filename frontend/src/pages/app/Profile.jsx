import { useId, useState } from "react";
import { useNavigate } from "react-router";
// Tabler, not the app's usual lucide set: it carries the trading-specific
// glyphs — a candle chart, an arrow in a bullseye — that a generic icon pack
// only approximates. One family across all four so the strokes match.
import { TbChartBar, TbReceipt2, TbScale, TbTargetArrow } from "react-icons/tb";
import Spinner from "@/components/Spinner";
import CoinIcon from "@/components/landing/CoinIcon";
import { useAuth } from "@/context/authContext";
import { Cell, CellRow, Panel, StatCard } from "@/components/app/Panel";
import Pagination from "@/components/app/Pagination";
import { pageOf } from "@/lib/paging";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Failed, Loading } from "@/components/app/QueryState";
import { useMe, useOrders, useTransactions } from "@/hooks/useOrbit";
import { formatUsd, signedUsd } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";

/** Closed trades shown on the card before the full ledger has to be opened. */
const PREVIEW_ROWS = 5;

/** Rows per page inside the ledger — shorter than a full page's table. */
const PAGE_SIZE = 8;

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ROW_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const QUANTITY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

// Read once at load rather than per render. A day counter has no business
// changing mid-session, and reading the clock during render isn't pure.
const LOADED_AT = Date.now();

function Highlight({ label, trade, value, tone, hint }) {
  const meta = trade ? coinMeta(trade.symbol) : null;

  return (
    <Cell label={label} value={value} tone={tone}>
      {meta ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CoinIcon symbol={meta.symbol} className="size-4" />
          {meta.ticker}
          <span className="text-faint">{ROW_DATE.format(new Date(trade.createdAt))}</span>
        </p>
      ) : (
        <p className="text-xs text-faint">{hint}</p>
      )}
    </Cell>
  );
}

/** One closed trade, laid out like a market row so the two lists read alike. */
function TradeRow({ trade }) {
  const meta = coinMeta(trade.symbol);
  const pnl = Number(trade.realizedPnl);
  const { side, quantity } = trade.order ?? {};

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_7rem]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
          <CoinIcon symbol={meta.symbol} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm text-foreground">
            {meta.ticker}
            <span className="text-faint">/USDT</span>
          </p>
          <p className="truncate text-xs text-faint">{meta.name}</p>
        </div>
      </div>

      <span className="tabular hidden text-sm text-muted-foreground lg:block">
        {quantity ? (
          <>
            {side === "SELL" ? "Sold" : "Bought"} {QUANTITY.format(Number(quantity))}{" "}
            <span className="text-faint">{baseAsset(trade.symbol)}</span>
          </>
        ) : (
          "—"
        )}
      </span>

      <span className="tabular hidden text-sm text-muted-foreground lg:block">
        {ROW_DATE.format(new Date(trade.createdAt))}
      </span>

      <div className="text-right leading-tight lg:w-28">
        <p className={`tabular text-sm font-medium ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
          {signedUsd(pnl)}
        </p>
        <p className="tabular text-xs text-faint lg:hidden">
          {ROW_DATE.format(new Date(trade.createdAt))}
        </p>
      </div>
    </li>
  );
}

/**
 * Column names, shared by the card preview and the full ledger so the two
 * lists read the same way — and the same names the markets list uses. Hidden
 * on small screens, where a row collapses to a market and its result.
 */
function ColumnHeader() {
  return (
    <div className="hidden grid-cols-[1.6fr_1fr_1fr_7rem] gap-4 border-b border-line px-5 py-3 text-xs text-faint sm:px-6 lg:grid">
      <span>Market</span>
      <span>Trade</span>
      <span>Closed</span>
      <span className="text-right">Realised</span>
    </div>
  );
}

/** The whole ledger, a page at a time, in a dialog over the page. */
function Ledger({ trades, open, onOpenChange }) {
  const [page, setPage] = useState(1);

  const { count: pageCount, current } = pageOf(page, trades.length, PAGE_SIZE);
  const visible = trades.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts at the newest trades rather than wherever the last
        // visit stopped reading.
        if (!next) setPage(1);
        onOpenChange(next);
      }}
    >
      <DialogContent className="grid-rows-[auto_auto_minmax(0,1fr)_auto] max-h-[85vh] gap-0 overflow-hidden border border-line bg-panel p-0 ring-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-line px-5 py-4 sm:px-6">
          <DialogTitle className="text-foreground">Trading history</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {trades.length} closed {trades.length === 1 ? "trade" : "trades"}, newest first
          </DialogDescription>
        </DialogHeader>

        <ColumnHeader />

        <ul className="scroll-thin min-h-0 overflow-y-auto">
          {visible.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </ul>

        <Pagination
          page={current}
          pageCount={pageCount}
          total={trades.length}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Every closed trade, newest first, with the headline figures on top.
 *
 * Collapsed to five rows by default: the highlights answer "how am I doing",
 * and the full ledger is a different question that only some visits ask.
 */
function TradingHistory({ trades }) {
  const [ledgerOpen, setLedgerOpen] = useState(false);

  if (trades.length === 0) {
    return (
      <Panel title="Trading history">
        <p className="text-sm text-muted-foreground">
          No closed trades yet. Your record starts the first time you sell.
        </p>
      </Panel>
    );
  }

  const best = trades.reduce((a, b) => (Number(b.realizedPnl) > Number(a.realizedPnl) ? b : a));
  const worst = trades.reduce((a, b) => (Number(b.realizedPnl) < Number(a.realizedPnl) ? b : a));
  const average =
    trades.reduce((sum, trade) => sum + Number(trade.realizedPnl), 0) / trades.length;

  const preview = trades.slice(0, PREVIEW_ROWS);

  return (
    <Panel
      title="Trading history"
      bodyClassName="p-0"
      action={
        trades.length > PREVIEW_ROWS && (
          <button
            type="button"
            onClick={() => setLedgerOpen(true)}
            className="rounded-full border border-line px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
          >
            View all {trades.length}
          </button>
        )
      }
    >
      <div className="border-b border-line">
        <CellRow>
          <Highlight
            label="Best trade"
            trade={best}
            value={signedUsd(Number(best.realizedPnl))}
            tone="text-gain"
          />
          <Highlight
            label="Worst trade"
            trade={worst}
            value={signedUsd(Number(worst.realizedPnl))}
            tone="text-loss"
          />
          <Highlight
            label="Average per trade"
            value={signedUsd(average)}
            tone={average >= 0 ? "text-gain" : "text-loss"}
            hint={`Across ${trades.length} closed ${trades.length === 1 ? "trade" : "trades"}`}
          />
        </CellRow>
      </div>

      <ColumnHeader />

      <ul>
        {preview.map((trade) => (
          <TradeRow key={trade.id} trade={trade} />
        ))}
      </ul>

      <Ledger trades={trades} open={ledgerOpen} onOpenChange={setLedgerOpen} />
    </Panel>
  );
}

const MIN_PASSWORD = 8;

/**
 * Changing a password, and dropping every session the account holds.
 *
 * Both are Supabase's to perform, not Orbit's: Orbit stores no credentials and
 * issues no tokens, so it has nothing to change and nothing to revoke. That is
 * why neither of these calls an Orbit endpoint.
 */
function Security() {
  const { user, updatePassword, signOutEverywhere } = useAuth();
  const navigate = useNavigate();
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [leaving, setLeaving] = useState(false);

  /**
   * A Google account has no password to change — Supabase would accept one and
   * quietly add a second way in, which is not what the button offers. Identities
   * is the reliable check: `provider` names how this session was created, while
   * an account can hold both.
   */
  const hasPassword = (user?.identities ?? []).some(
    (identity) => identity.provider === "email",
  );

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = form.get("password");

    if (String(password).length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== form.get("confirm")) {
      setError("Those two passwords don't match.");
      return;
    }

    setBusy(true);
    const { error: failed } = await updatePassword(password);
    setBusy(false);

    if (failed) {
      setError(failed.message);
      return;
    }

    setOpen(false);
    setDone("Password changed. Your other devices stay signed in.");
  };

  /**
   * This signs out the tab it was clicked in too, which is the point rather
   * than a side effect: "everywhere" that spared the device in front of you
   * would be a strange promise to keep.
   */
  const leaveEverywhere = async () => {
    setDone(null);
    setError(null);
    setLeaving(true);

    const { error: failed } = await signOutEverywhere();

    if (failed) {
      setLeaving(false);
      setError(failed.message);
      return;
    }

    navigate("/", { replace: true });
  };

  const field =
    "w-full rounded-xl border border-line bg-void px-3.5 py-2.5 text-sm text-foreground placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

  return (
    <Panel title="Security">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your password protects your trading history and nothing else — Orbit
          holds no funds and stores no payment details. Sign-in is handled by
          Supabase; Orbit never sees your password.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDone(null);
              setOpen(true);
            }}
            disabled={!hasPassword}
            title={hasPassword ? undefined : "You sign in with Google, so there's no password to change."}
            className="rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            Change password
          </button>
          <button
            type="button"
            onClick={leaveEverywhere}
            disabled={leaving}
            aria-busy={leaving}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:opacity-60"
          >
            {leaving && <Spinner className="size-3" />}
            {leaving ? "Signing out…" : "Sign out everywhere"}
          </button>
        </div>
      </div>

      {!hasPassword && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          You sign in with Google, so there's no Orbit password to change. Your
          Google account settings control access.
        </p>
      )}

      {(done || error) && !open && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed ${
            error
              ? "border border-loss/30 bg-loss/10 text-loss"
              : "border border-gain/30 bg-gain/10 text-gain"
          }`}
        >
          {error ?? done}
        </p>
      )}

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="page max-w-[calc(100%-2rem)] rounded-2xl border border-line bg-panel p-7 sm:max-w-100">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold tracking-[-0.02em]">
              Change password
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your other devices stay signed in. Use “Sign out everywhere” if you
              want them out.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="mt-2 space-y-3 text-left">
            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-new`} className="text-xs text-muted-foreground">
                New password
              </label>
              <input
                id={`${fieldId}-new`}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                className={field}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-confirm`} className="text-xs text-muted-foreground">
                Confirm new password
              </label>
              <input
                id={`${fieldId}-confirm`}
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                className={field}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-loss/30 bg-loss/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-loss">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {busy && <Spinner className="size-3" />}
                {busy ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

export default function Profile() {
  const me = useMe();
  const orders = useOrders(200);
  const transactions = useTransactions(200);

  if (me.isPending) return <Loading label="Loading your profile" />;
  if (me.isError) return <Failed error={me.error} onRetry={me.refetch} />;

  const user = me.data.user;
  const rows = transactions.data?.transactions ?? [];

  // The API already returns newest first, which is the order a ledger reads in.
  const closed = rows.filter((row) => row.realizedPnl != null);
  const wins = closed.filter((row) => Number(row.realizedPnl) > 0).length;
  const realised = closed.reduce((sum, row) => sum + Number(row.realizedPnl), 0);
  const traded = (orders.data?.orders ?? []).reduce((sum, order) => sum + Number(order.total), 0);

  const joined = new Date(user.createdAt);
  const days = Math.max(1, Math.round((LOADED_AT - joined) / 86_400_000));

  return (
    // No width cap: the shell already sets the gutter, and a second one just
    // wastes the half of the screen the tables want.
    <div className="space-y-5 p-4 sm:p-6">
      {/* Identity and the account facts are one card. Name and email are
          already in the header, so a separate details panel would have been
          three real rows padded out with two repeats. */}
      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 p-5 sm:p-6">
          <span
            style={{ "--tint": "var(--color-brand)" }}
            className="tint-chip grid size-16 shrink-0 place-items-center rounded-full font-display text-2xl font-bold"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-brand uppercase">
              Paper trader · Day {days}
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
              {user.name}
            </h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <p className="ml-auto text-xs text-faint">Trading since {DATE.format(joined)}</p>
        </div>

        <div className="border-t border-line">
          <CellRow>
            <Cell label="Account type" value="Paper trading" />
            <Cell
              label="Starting balance"
              value={formatUsd(Number(me.data.wallet.startingCash))}
            />
            <Cell
              label="Cash today"
              value={formatUsd(Number(me.data.wallet.balance))}
              tone={
                Number(me.data.wallet.balance) >= Number(me.data.wallet.startingCash)
                  ? "text-gain"
                  : "text-loss"
              }
            />
          </CellRow>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders placed"
          value={orders.data?.orders.length ?? "—"}
          hint="All time"
          accent="iris"
          icon={TbReceipt2}
        />
        <StatCard
          label="Win rate"
          value={closed.length ? `${Math.round((wins / closed.length) * 100)}%` : "—"}
          hint={`${wins} of ${closed.length} sells in profit`}
          accent="mint"
          icon={TbTargetArrow}
        />
        <StatCard
          label="Realised P&L"
          value={signedUsd(realised)}
          tone={realised >= 0 ? "gain" : "loss"}
          hint="Booked on sells"
          accent="ember"
          icon={TbScale}
        />
        <StatCard
          label="Volume traded"
          value={formatUsd(traded)}
          hint="Buys and sells"
          accent="sky"
          icon={TbChartBar}
        />
      </div>

      <TradingHistory trades={closed} />

      <Security />
    </div>
  );
}
