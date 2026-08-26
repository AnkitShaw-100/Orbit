import { Link } from "react-router";
import CoinIcon from "@/components/landing/CoinIcon";
import BaselineBar from "@/components/app/BaselineBar";
import { Panel, StatCard } from "@/components/app/Panel";
import { Failed, Loading } from "@/components/app/QueryState";
import { usePortfolio } from "@/hooks/useOrbit";
import { formatPercent, formatPrice, formatUsd } from "@/lib/format";

const tickerOf = (symbol) => symbol.replace("USDT", "");

export default function Portfolio() {
  const portfolio = usePortfolio();

  if (portfolio.isPending) return <Loading label="Loading your positions" />;
  if (portfolio.isError) return <Failed error={portfolio.error} onRetry={portfolio.refetch} />;

  const p = portfolio.data;
  const totalValue = Number(p.totalValue);
  const positionsValue = Number(p.positionsValue);
  const unrealised = Number(p.unrealizedPnl);
  const totalReturn = Number(p.totalReturnPct);
  const startingCash = Number(p.startingCash);

  const allocation = [...p.holdings].sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total value" value={formatUsd(totalValue)} hint="Cash plus positions" />
        <StatCard
          label="Positions"
          value={formatUsd(positionsValue)}
          hint={`${p.holdings.length} open`}
        />
        <StatCard
          label="Unrealised P&L"
          value={`${unrealised >= 0 ? "+" : "−"}${formatUsd(Math.abs(unrealised)).slice(1)}`}
          tone={unrealised >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Total return"
          value={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`}
          hint={`From ${formatUsd(startingCash)}`}
          tone={totalReturn >= 0 ? "gain" : "loss"}
        />
      </div>

      <Panel>
        <BaselineBar value={totalValue} baseline={startingCash} />
      </Panel>

      {p.holdings.length === 0 ? (
        <Panel title="Holdings">
          <div className="py-12 text-center">
            <p className="text-sm text-foreground">Nothing held yet</p>
            <p className="mx-auto mt-1.5 max-w-[42ch] text-xs leading-relaxed text-foreground/45">
              All {formatUsd(Number(p.cash))} of your virtual cash is uninvested. Buy
              something and this page starts telling you whether it was a good idea.
            </p>
            <Link
              to="/trade"
              className="mt-5 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-ink"
            >
              Go to trade
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <Panel title="Allocation">
            {/* A stacked bar rather than a doughnut — it reads faster at this
                number of holdings and stays legible on a phone. */}
            <div className="flex h-3 overflow-hidden rounded-full bg-foreground/5">
              {allocation.map((row, index) => (
                <span
                  key={row.symbol}
                  title={`${tickerOf(row.symbol)} ${((Number(row.value) / positionsValue) * 100).toFixed(1)}%`}
                  style={{
                    width: `${(Number(row.value) / positionsValue) * 100}%`,
                    opacity: 1 - index * 0.18,
                  }}
                  className="bg-gain"
                />
              ))}
            </div>

            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {allocation.map((row, index) => (
                <li key={row.symbol} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2 rounded-full bg-gain"
                    style={{ opacity: 1 - index * 0.18 }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{tickerOf(row.symbol)}</span>
                  <span className="tabular text-foreground/45">
                    {((Number(row.value) / positionsValue) * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Holdings" bodyClassName="p-0">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] gap-4 border-b border-line px-5 py-3 text-xs text-foreground/40 lg:grid">
              <span>Asset</span>
              <span className="text-right">Quantity</span>
              <span className="text-right">Avg price</span>
              <span className="text-right">Market price</span>
              <span className="text-right">Value / P&L</span>
            </div>

            <ul>
              {p.holdings.map((row) => {
                const pnl = Number(row.unrealizedPnl);
                return (
                  <li
                    key={row.symbol}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground">
                        <CoinIcon symbol={row.symbol} />
                      </span>
                      <div className="min-w-0 leading-tight">
                        <p className="text-sm text-foreground">{tickerOf(row.symbol)}</p>
                        <p className="truncate text-xs text-foreground/40">{row.symbol}</p>
                      </div>
                    </div>

                    <span className="tabular hidden text-right text-sm text-foreground/70 lg:block">
                      {Number(row.quantity)}
                    </span>
                    <span className="tabular hidden text-right text-sm text-foreground/70 lg:block">
                      {formatPrice(Number(row.averagePrice))}
                    </span>
                    <span className="tabular hidden text-right text-sm text-foreground lg:block">
                      {formatPrice(Number(row.marketPrice))}
                    </span>

                    <div className="text-right leading-tight">
                      <p className="tabular text-sm text-foreground">{formatUsd(Number(row.value))}</p>
                      <p className={`tabular text-xs ${pnl >= 0 ? "text-gain" : "text-loss"}`}>
                        {pnl >= 0 ? "+" : "−"}
                        {formatUsd(Math.abs(pnl)).slice(1)} (
                        {formatPercent(Number(row.unrealizedPnlPct))})
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
