import { Link } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Bell, Copy, LayoutGrid, Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";

const EASE = [0.22, 1, 0.36, 1];

const HOLDINGS = [
  { ticker: "E", symbol: "ETH", name: "Ethereum", qty: "2.06", value: "3 361.24" },
  { ticker: "B", symbol: "BTC", name: "Bitcoin", qty: "4.12", value: "106 074.34" },
];

const ACTIONS = [
  { icon: Plus, label: "Buy" },
  { icon: ArrowDownLeft, label: "Receive" },
  { icon: ArrowUpRight, label: "Send" },
];

/**
 * A gradient disc lit from the upper left.
 *
 * The radial gradient runs white → peach → rose → violet outward from that
 * light source, which is what gives it volume; a blurred specular blob sits on
 * top for the wet highlight, and the slow yaw makes it read as a solid object
 * turning in space rather than a flat sticker.
 */
function Disc({ className, tilt = 0, duration = 11, delay = 0, drift = 16 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute z-0 ${className}`}
      initial={{ rotate: tilt }}
      animate={reduceMotion ? undefined : { y: [0, -drift, 0], rotate: [tilt, tilt + 7, tilt] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <div
        className="relative size-full rounded-[50%]"
        style={{
          background:
            "radial-gradient(115% 130% at 30% 20%, #FFFFFF 0%, #FCE0C0 20%, #F7C8DC 48%, #CDB4EC 74%, #8E74CE 100%)",
          boxShadow:
            "0 34px 55px -20px rgba(55,35,110,0.6), inset 0 -12px 24px rgba(110,80,180,0.45), inset 0 6px 12px rgba(255,255,255,0.6)",
        }}
      >
        <span className="absolute left-[16%] top-[12%] h-[28%] w-[36%] rounded-[50%] bg-white/75 blur-[7px]" />
      </div>
    </motion.div>
  );
}

export default function PocketSection({ ticker }) {
  const reduceMotion = useReducedMotion();

  const reveal = (delay = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.65, delay, ease: EASE },
  });

  return (
    <section className="grid lg:grid-cols-2">
      <div className="relative flex items-end justify-center overflow-hidden border-white/10 px-6 pt-24 lg:border-r">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 56 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.85, ease: EASE }}
          // Pushed past the container's bottom edge so overflow-hidden clips
          // the frame cleanly — otherwise its bottom rim reads as a cut-off
          // half phone.
          className="-mb-16"
        >
          <motion.div
            // Capped rather than fixed — a hard 322px overflows a 360px screen
            // once the section's gutters are taken out, which widens the page.
            className="relative w-full max-w-80.5"
            animate={reduceMotion ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Volume and power keys, tucked behind the frame's edge. */}
            <span className="absolute -left-[3px] top-32 h-12 w-[3px] rounded-l bg-white/15" />
            <span className="absolute -left-[3px] top-48 h-12 w-[3px] rounded-l bg-white/15" />
            <span className="absolute -right-[3px] top-40 h-16 w-[3px] rounded-r bg-white/15" />

            <div
              className="rounded-t-[48px] p-3"
              style={{
                background: "linear-gradient(150deg, #3A3A3A 0%, #0B0B0B 42%, #262626 100%)",
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,0.16), 0 40px 80px -30px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              <div className="relative overflow-hidden rounded-t-[38px] bg-[#CFE3DE] px-5 pb-12 pt-4">
                <div className="mx-auto mb-4 h-6 w-24 rounded-full bg-ink/90" />

                <header className="flex items-center justify-between text-ink">
                  <span className="grid size-7 place-items-center rounded-full border border-ink/25">
                    <span className="size-1.5 rounded-full bg-ink" />
                  </span>
                  <div className="flex gap-3 text-ink/60">
                    <Copy className="size-4" aria-hidden="true" />
                    <LayoutGrid className="size-4" aria-hidden="true" />
                    <Bell className="size-4" aria-hidden="true" />
                  </div>
                </header>

                <p className="tabular mt-7 text-center font-display text-[32px] font-bold tracking-tight text-ink">
                  ${ticker?.price ? formatPrice(ticker.price * 1.74) : "110 786.32"}
                </p>

                <div className="mt-6 flex justify-center gap-3">
                  {ACTIONS.map(({ icon: Icon, label }, index) => (
                    <motion.div key={label} {...reveal(0.25 + index * 0.08)} className="text-center">
                      <span className="grid size-12 place-items-center rounded-2xl bg-ink text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.7)]">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="mt-1.5 block text-[10px] text-ink/60">{label}</span>
                    </motion.div>
                  ))}
                </div>

                <p className="mt-7 text-xs text-ink/50">Items</p>
                <ul className="mt-2.5 space-y-2">
                  {HOLDINGS.map((holding, index) => (
                    <motion.li
                      key={holding.symbol}
                      {...reveal(0.45 + index * 0.1)}
                      className="flex items-center gap-3 rounded-2xl bg-white/60 px-3.5 py-3 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.25)]"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-white text-[10px] font-bold text-ink">
                        {holding.ticker}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink">{holding.symbol}</p>
                        <p className="text-[10px] text-ink/45">{holding.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-xs font-medium text-ink">{holding.qty}</p>
                        <p className="tabular text-[10px] text-ink/45">${holding.value}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>

                {/* Screen glare — one diagonal sheen across the glass. */}
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(118deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 26%, transparent 46%)",
                  }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="relative flex flex-col justify-center overflow-hidden px-6 py-20 sm:px-12 sm:py-28 2xl:px-20">
        {/* Kept clear of the copy — the discs sit in the margins, never behind
            a line of text. */}
        <Disc className="-top-16 right-2 h-36 w-64 lg:right-10" tilt={-14} duration={12} />
        <Disc
          className="-left-24 bottom-10 h-24 w-44 sm:-left-20"
          tilt={20}
          duration={9}
          delay={1.2}
          drift={11}
        />

        <motion.h2 {...reveal()} className="h2-section relative z-10 max-w-[13ch] text-white">
          Practice on the train home
        </motion.h2>

        <motion.p
          {...reveal(0.12)}
          className="relative z-10 mt-7 max-w-[46ch] text-[15px] leading-relaxed text-white/55"
        >
          Orbit runs in the browser on any screen, so a spare ten minutes is
          enough to place a trade and see how it played out. Nothing to install
          and no account balance to protect.
        </motion.p>

        <motion.div {...reveal(0.24)} className="relative z-10 mt-10">
          <Link
            to="/signup"
            className="inline-flex items-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-ink transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Open Orbit
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
