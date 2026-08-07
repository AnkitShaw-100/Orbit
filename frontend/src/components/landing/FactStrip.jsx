import { Landmark, ShieldCheck, Wallet } from "lucide-react";

// The reference layout puts client logos here. Orbit has no clients, so the
// cells carry the three facts that actually answer "is this safe to try?".
const FACTS = [
  { icon: Wallet, label: "$100,000 to start" },
  { icon: Landmark, label: "Live Binance prices" },
  { icon: ShieldCheck, label: "No card, no real funds" },
];

export default function FactStrip() {
  return (
    <ul className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {FACTS.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2.5 px-6 py-5 sm:justify-center sm:px-4">
          <Icon className="size-4 shrink-0 text-white/40" aria-hidden="true" />
          <span className="text-[13px] font-medium text-white/60">{label}</span>
        </li>
      ))}
    </ul>
  );
}
