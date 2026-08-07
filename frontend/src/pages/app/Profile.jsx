import { Panel, StatCard } from "@/components/app/Panel";
import { Failed, Loading } from "@/components/app/QueryState";
import { useMe, useOrders, useTransactions } from "@/hooks/useOrbit";
import { formatUsd } from "@/lib/format";

export default function Profile() {
  const me = useMe();
  const orders = useOrders(200);
  const transactions = useTransactions(200);

  if (me.isPending) return <Loading label="Loading your profile" />;
  if (me.isError) return <Failed error={me.error} onRetry={me.refetch} />;

  const user = me.data.user;
  const rows = transactions.data?.transactions ?? [];
  const closed = rows.filter((row) => row.realizedPnl != null);
  const wins = closed.filter((row) => Number(row.realizedPnl) > 0).length;
  const realised = closed.reduce((sum, row) => sum + Number(row.realizedPnl), 0);
  const traded = (orders.data?.orders ?? []).reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <span className="grid size-16 place-items-center rounded-full bg-white font-display text-xl font-bold text-ink">
            {user.name.slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold tracking-tight text-white">{user.name}</h2>
            <p className="text-sm text-white/45">{user.email}</p>
          </div>

          <p className="ml-auto text-xs text-white/40">
            Trading since{" "}
            {new Date(user.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders placed" value={orders.data?.orders.length ?? "—"} hint="All time" />
        <StatCard
          label="Win rate"
          value={closed.length ? `${Math.round((wins / closed.length) * 100)}%` : "—"}
          hint={`${wins} of ${closed.length} sells in profit`}
        />
        <StatCard
          label="Realised P&L"
          value={`${realised >= 0 ? "+" : "−"}${formatUsd(Math.abs(realised)).slice(1)}`}
          tone={realised >= 0 ? "gain" : "loss"}
          hint="Booked on sells"
        />
        <StatCard label="Volume traded" value={formatUsd(traded)} hint="Buys and sells" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Account details">
          <dl className="space-y-4">
            {[
              ["Name", user.name],
              ["Email", user.email],
              ["Account type", "Paper trading"],
              ["Starting balance", formatUsd(Number(me.data.wallet.startingCash))],
              ["Cash today", formatUsd(Number(me.data.wallet.balance))],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-line pb-4 last:border-b-0 last:pb-0"
              >
                <dt className="text-xs text-white/45">{label}</dt>
                <dd className="text-sm text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Security">
          <p className="text-sm leading-relaxed text-white/50">
            Your password protects your trading history and nothing else — Orbit
            holds no funds and stores no payment details. Sign-in is handled by
            Supabase; Orbit never sees your password.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-ink"
            >
              Change password
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-5 py-2.5 text-xs font-medium text-white/70 transition-colors hover:text-white"
            >
              Sign out everywhere
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
