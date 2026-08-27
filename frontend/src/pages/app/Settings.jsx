import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Panel } from "@/components/app/Panel";
import { formatUsd } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";

function Row({ label, description, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="max-w-[52ch] min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Three states, not a switch: "system" is a real choice, not the absence of one. */
function ThemeChoice({ theme, onChange }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-full border border-line p-1">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              active
                ? "bg-brand text-ink"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [resetArmed, setResetArmed] = useState(false);

  return (
    <div className="max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h2 className="font-display text-xl font-bold tracking-[-0.03em] text-foreground">
          Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your theme is saved on this device.
        </p>
      </header>

      <Panel title="Appearance">
        <Row
          label="Theme"
          description="System follows whatever your device is set to, including a schedule that switches at sunset."
        >
          <ThemeChoice theme={theme} onChange={setTheme} />
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
                className="rounded-full bg-loss px-4 py-2 text-xs font-semibold text-on-loss"
              >
                Yes, reset it
              </button>
              <button
                type="button"
                onClick={() => setResetArmed(false)}
                className="rounded-full border border-line px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
    </div>
  );
}
