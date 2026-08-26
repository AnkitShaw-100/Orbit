import { useState } from "react";
// Tabler, not the app's usual lucide set: it carries the trading-specific
// glyphs — a candle chart, an arrow in a bullseye — that a generic icon pack
// only approximates. One family across all four so the strokes match.
import { TbChartBar, TbReceipt2, TbScale, TbTargetArrow } from "react-icons/tb";
import CoinIcon from "@/components/landing/CoinIcon";
import { Panel, StatCard } from "@/components/app/Panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Failed, Loading } from "@/components/app/QueryState";
import { useMe, useOrders, useTransactions } from "@/hooks/useOrbit";
import { formatUsd } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";

/** Closed trades shown on the card before the full ledger has to be opened. */
const PREVIEW_ROWS = 5;

/** Rows per page inside the ledger. */
const PAGE_SIZE = 8;

/** Most page buttons rendered at once, so a long history cannot grow a rail. */
const PAGE_WINDOW = 7;

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

/** A realised figure with its sign, always as money. */
function signedUsd(value) {
  return `${value >= 0 ? "+" : "−"}${formatUsd(Math.abs(value))}`;
}

/**
 * The three numbers a paper trader checks before reading any rows: the best
 * result, the worst, and what the average trade actually returns. The average
 * is the one a win rate hides — six wins against twelve losses can still be
 * the better book if the wins are the large ones.
 */
function Cell({ label, value, tone = "text-foreground", children }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
      <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{label}</p>
      <p className={`tabular font-display text-xl font-bold tracking-[-0.03em] ${tone}`}>{value}</p>
      {children}
    </div>
  );
}

/** The row of cells both cards use, so the profile and the history rhyme. */
function CellRow({ children }) {
  return (
    <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {children}
    </div>
  );
}

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

/**
 * The page numbers to render, windowed around the current page.
 *
 * A paper trader can close hundreds of positions; listing every page would
 * grow a rail of buttons wider than the table it belongs to.
 */
function pageNumbers(current, count) {
  if (count <= PAGE_WINDOW) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  const half = Math.floor(PAGE_WINDOW / 2);
  const start = Math.min(Math.max(current - half, 1), count - PAGE_WINDOW + 1);
  return Array.from({ length: PAGE_WINDOW }, (_, index) => start + index);
}

/** The whole ledger, a page at a time, in a dialog over the page. */
function Ledger({ trades, open, onOpenChange }) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
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

        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
            <p className="tabular text-xs text-faint">
              {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, trades.length)} of{" "}
              {trades.length}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current === 1}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-muted-foreground"
              >
                Previous
              </button>

              {pageNumbers(current, pageCount).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  aria-current={number === current ? "page" : undefined}
                  className={`tabular size-8 rounded-full text-xs transition-colors ${
                    number === current
                      ? "bg-brand font-semibold text-ink"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {number}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current === pageCount}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-muted-foreground"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
      <section className="accent-wash overflow-hidden rounded-2xl border border-line">
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
              className="rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
            >
              Change password
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
            >
              Sign out everywhere
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
