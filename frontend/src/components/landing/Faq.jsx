import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FiPlus } from "react-icons/fi";

const QUESTIONS = [
  {
    question: "Is any of this real money?",
    answer:
      "No. Your balance is virtual and nothing ever leaves or enters a bank account. Orbit never asks for a card, holds no funds, and cannot place an order on a real exchange. The only thing that is real is the price data.",
  },
  {
    question: "Where do the prices come from?",
    answer:
      "Binance's public market data, streamed over a WebSocket connection. The prices you trade against are the same ones the exchange is quoting at that moment, so a fill at 11:04 reflects what the market was actually doing at 11:04.",
  },
  {
    question: "What can I trade?",
    answer:
      "Spot crypto pairs with market orders. No leverage, no short selling and no futures — the instruments most likely to teach a beginner an expensive lesson are deliberately absent. Limit orders and stop-losses arrive in Phase 2.",
  },
  {
    question: "Can I reset my balance?",
    answer:
      "Yes. Wiping the account back to $100,000 lives in settings, so one bad run doesn't end the experiment. Your transaction history is cleared at the same time.",
  },
  {
    question: "Does practising here actually help?",
    answer:
      "It teaches mechanics — order types, position sizing, reading a book, watching P&L move against you. What it cannot teach is how losing your own money feels, and that gap is the reason paper traders often behave very differently once the stakes are real.",
  },
];

const EASE = [0.22, 1, 0.36, 1];

export default function Faq() {
  const [open, setOpen] = useState(2);
  const reduceMotion = useReducedMotion();

  const duration = reduceMotion ? 0 : 0.42;

  return (
    <section className="section">
      <h2 className="text-center font-display text-[clamp(2.6rem,5vw,3.6rem)] font-normal tracking-[-0.01em] text-foreground">
        FAQ
      </h2>

      <ul className="shell mt-16">
        {QUESTIONS.map((item, index) => {
          const isOpen = open === index;
          // The open row becomes a card, so the rules touching it fade out.
          const showRule = !isOpen && open !== index - 1;

          return (
            <li
              key={item.question}
              className={`border-t transition-colors duration-500 ${
                showRule ? "border-white/12" : "border-transparent"
              }`}
            >
              <div
                className={`rounded-2xl px-4 transition-colors duration-500 sm:px-8 ${
                  isOpen ? "bg-panel-2" : "bg-transparent"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3.5 py-5 text-left sm:gap-6 sm:py-6"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-foreground sm:size-2.5" aria-hidden="true" />
                    <span className="tabular w-6 shrink-0 text-[13px] text-faint sm:w-8 sm:text-[15px]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[15px] text-foreground sm:text-base">{item.question}</span>

                    {/* One icon rotated 45° rather than swapping glyphs, so the
                        plus turns into the minus in a single motion. */}
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration, ease: EASE }}
                      className="shrink-0 text-muted-foreground"
                    >
                      <FiPlus className="size-5" aria-hidden="true" />
                    </motion.span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration, ease: EASE },
                        opacity: { duration: duration * 0.7, ease: "easeOut" },
                      }}
                      className="overflow-hidden"
                    >
                      <motion.p
                        initial={{ y: -6 }}
                        animate={{ y: 0 }}
                        exit={{ y: -6 }}
                        transition={{ duration, ease: EASE }}
                        className="max-w-[92ch] pb-6 pl-9 pr-2 text-sm leading-[1.7] text-muted-foreground sm:pb-7 sm:pl-14 sm:pr-8 sm:text-[15px]"
                      >
                        {item.answer}
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          );
        })}

        <li
          className={`border-t transition-colors duration-500 ${
            open === QUESTIONS.length - 1 ? "border-transparent" : "border-white/12"
          }`}
        />
      </ul>
    </section>
  );
}
