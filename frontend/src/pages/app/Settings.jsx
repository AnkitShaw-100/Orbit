import { useState } from "react";
import { Panel } from "@/components/app/Panel";
import { formatUsd } from "@/lib/format";

function Row({ label, description, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0 max-w-[46ch]">
        <p className="text-sm text-white">{label}</p>
        {description && <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        checked ? "bg-gain" : "bg-white/15"
      }`}
    >
      <span
        className={`block size-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const [confirmOrders, setConfirmOrders] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [compactRows, setCompactRows] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  return (
    <div className="max-w-3xl space-y-5 p-4 sm:p-6">
      <Panel title="Trading">
        <Row
          label="Confirm before placing an order"
          description="Shows a summary of quantity and cost before the order fills. Turn this off once the mechanics feel familiar."
        >
          <Toggle checked={confirmOrders} onChange={setConfirmOrders} label="Confirm before placing an order" />
        </Row>
        <Row
          label="Price alerts"
          description="Notify me when a coin on my watchlist moves more than 5% in a day."
        >
          <Toggle checked={priceAlerts} onChange={setPriceAlerts} label="Price alerts" />
        </Row>
      </Panel>

      <Panel title="Appearance">
        <Row
          label="Theme"
          description="Orbit is built for dark rooms and long sessions. A light theme is planned."
        >
          <span className="rounded-full border border-line px-4 py-2 text-xs text-white/50">
            Dark
          </span>
        </Row>
        <Row label="Compact tables" description="Tighter rows so more of your history fits on screen.">
          <Toggle checked={compactRows} onChange={setCompactRows} label="Compact tables" />
        </Row>
      </Panel>

      <Panel title="Danger zone" className="border-loss/30">
        <Row
          label="Reset account"
          description={`Wipes every position and transaction and returns your wallet to ${formatUsd(100000)}. This cannot be undone.`}
        >
          {resetArmed ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full bg-loss px-4 py-2 text-xs font-semibold text-white"
              >
                Yes, reset it
              </button>
              <button
                type="button"
                onClick={() => setResetArmed(false)}
                className="rounded-full border border-line px-4 py-2 text-xs text-white/60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setResetArmed(true)}
              className="rounded-full border border-loss/40 px-5 py-2.5 text-xs font-medium text-loss transition-colors hover:bg-loss/10"
            >
              Reset account
            </button>
          )}
        </Row>

        <Row
          label="Delete account"
          description="Removes your login, history and holdings from Orbit entirely."
        >
          <button
            type="button"
            className="rounded-full border border-loss/40 px-5 py-2.5 text-xs font-medium text-loss transition-colors hover:bg-loss/10"
          >
            Delete account
          </button>
        </Row>
      </Panel>

      <p className="text-[11px] text-white/30">
        Settings are stored locally until the accounts service is connected.
      </p>
    </div>
  );
}
