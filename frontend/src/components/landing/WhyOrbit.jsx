import { useState } from "react";
import { useNavigate } from "react-router";
import { FaCircleCheck } from "react-icons/fa6";
import { formatPrice } from "@/lib/format";

const POINTS = [
  "Every order fills at the live market price",
  "You can't spend cash or coins you don't have",
  "Realised and unrealised P&L update on every tick",
  "Reset to $100,000 whenever a run goes badly",
];

const BALANCE = 100000;
const PERCENTS = [25, 50, 75];

export default function WhyOrbit({ ticker }) {
  const price = ticker?.price;
  const navigate = useNavigate();
  const [side, setSide] = useState("buy");
  const [percent, setPercent] = useState(50);

  const total = (BALANCE * percent) / 100;
  const amount = price ? total / price : null;

  // The real trade screen doesn't exist yet, so the ticket lands on the
  // not-found page rather than pretending to submit an order.
  const handleSubmit = () => navigate("/trade");

  return (
    <section className="section">
      <div className="shell grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-10">
        <div>
          <h2 className="h2-section max-w-[12ch] text-white">
            Built to teach, not to flatter
          </h2>

          <ul className="mt-10 space-y-5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3.5">
                <FaCircleCheck className="size-6 shrink-0 text-white/85" aria-hidden="true" />
                <span className="text-[15px] text-white/75">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-120">
          {/* Order ticket — gradient edge, matching the reference's framed card. */}
          <div className="orbit-gradient rounded-[22px] p-[3px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.85)]">
            <div className="rounded-[19px] bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  {["buy", "sell"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSide(option)}
                      aria-pressed={side === option}
                      className={`rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition-colors ${
                        side === option
                          ? "bg-ink text-white"
                          : "border border-ink/15 text-ink hover:border-ink/40"
                      }`}
                    >
                      {option} BTC
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 text-[11px]">
                  {PERCENTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPercent(option)}
                      aria-pressed={percent === option}
                      className={`rounded px-1 transition-colors ${
                        percent === option
                          ? "font-semibold text-ink"
                          : "text-ink/45 hover:text-ink"
                      }`}
                    >
                      {option}%
                    </button>
                  ))}
                </div>
              </div>

              <p className="tabular mt-4 text-xs text-ink/50">
                Balance {BALANCE.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
              </p>

              <dl className="mt-4 space-y-2.5">
                {[
                  ["Price", price ? `${formatPrice(price)} USD` : "—", true],
                  ["Amount", amount ? `${amount.toFixed(4)} BTC` : "—", false],
                  [
                    "Total",
                    `${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD`,
                    false,
                  ],
                ].map(([label, value, live]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-xl bg-mist px-4 py-3.5"
                  >
                    <dt className="flex items-center gap-1.5 text-[13px] text-ink/50">
                      {live && (
                        <span className="size-1.5 animate-pulse rounded-full bg-gain" aria-hidden="true" />
                      )}
                      {label}
                    </dt>
                    <dd className="tabular text-[13px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <button
                type="button"
                onClick={handleSubmit}
                className="mt-5 w-full rounded-full bg-ink py-3 text-center text-[13px] font-semibold capitalize text-white transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {side} {amount ? `${amount.toFixed(4)} BTC` : "BTC"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
