import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];

// Straight from the feedback survey: the look-and-feel rating (out of 5) and
// the answer to "Would you use Orbit again?". Nothing is paraphrased — these
// people rated the product, they didn't write quotes, so none are invented.
//
// Photos in public/testimonials/ are square, face-centred 320px crops of the
// originals in public/testimonial images/. Feeding the raw portraits and
// landscapes into a circle either squashed them or cropped to a shirt.
const REVIEWS = [
  { name: "Shreya Shaw", rating: 4, again: "Occasionally", photo: "/testimonials/shreya.jpg" },
  { name: "Manish Kumar", rating: 5, again: "Yes, a few times a week", photo: "/testimonials/manish.jpg" },
  { name: "Sujal", rating: 3, again: "Yes, a few times a week", photo: "/testimonials/sujal.jpg" },
  { name: "Yash Hallan", rating: 4, again: "Occasionally", photo: "/testimonials/yash.jpg" },
  { name: "AKS", rating: 5, again: "Occasionally", photo: "/testimonials/aks.jpg" },
  { name: "Arpan Chowdhury", rating: 5, again: "Yes, a few times a week", photo: "/testimonials/arpan.jpg" },
];

const average = REVIEWS.reduce((sum, review) => sum + review.rating, 0) / REVIEWS.length;

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={`size-4 ${index < rating ? "fill-brand text-brand" : "fill-line text-line"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ name, rating, again, photo }) {
  const frequent = again.startsWith("Yes");

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-panel p-6 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-brand/40 sm:p-7">
      {/* A soft brand glow in the corner, brighter on hover, so the cards read
          as lit surfaces rather than flat boxes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-brand/10 opacity-50 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <Quote
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-6 size-10 fill-brand/10 text-transparent"
      />

      {/* Who said it, first — a face makes the rest of the card believable. */}
      <header className="relative flex items-center gap-4">
        <img
          src={photo}
          alt={name}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="aspect-square size-16 shrink-0 rounded-full object-cover object-center ring-2 ring-brand/40 ring-offset-2 ring-offset-panel"
        />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold tracking-tight text-foreground">{name}</p>
          <span
            className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              frequent ? "bg-gain/10 text-gain" : "bg-brand/10 text-brand"
            }`}
          >
            <span className={`size-1.5 rounded-full ${frequent ? "bg-gain" : "bg-brand"}`} />
            {frequent ? "Weekly trader" : "Occasional trader"}
          </span>
        </div>
      </header>

      <div className="relative mt-7">
        <p className="text-[11px] uppercase tracking-[0.16em] text-faint">Would you use Orbit again?</p>
        <p className="mt-2 font-display text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
          “{again}.”
        </p>
      </div>

      <div className="relative mt-auto pt-7">
        <div className="flex items-center justify-between rounded-2xl border border-line bg-panel-2 px-4 py-3">
          <span className="text-xs text-muted-foreground">Look &amp; feel</span>
          <div className="flex items-center gap-2.5">
            <Stars rating={rating} />
            <span className="tabular font-display text-sm font-bold text-foreground">{rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Testimonials() {
  const reduceMotion = useReducedMotion();
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState([]);

  const onSelect = useCallback((api) => setSelected(api.selectedScrollSnap()), []);

  useEffect(() => {
    if (!embla) return;
    const onInit = (api) => {
      setSnaps(api.scrollSnapList());
      onSelect(api);
    };
    onInit(embla);
    embla.on("select", onSelect);
    embla.on("reInit", onInit);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onInit);
    };
  }, [embla, onSelect]);

  const arrow =
    "grid size-10 place-items-center rounded-full border border-line bg-panel text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground";

  return (
    <section className="section" id="testimonials">
      <div className="shell">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <h2 className="h2-section max-w-[18ch] text-foreground">What early traders said</h2>
            <p className="tabular mt-3 text-sm text-muted-foreground">
              <span className="font-display text-xl font-bold text-foreground">{average.toFixed(1)}</span>
              {" / 5 for look and feel · "}
              {REVIEWS.length} responses
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button" className={arrow} onClick={() => embla?.scrollPrev()} aria-label="Previous review">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" className={arrow} onClick={() => embla?.scrollNext()} aria-label="Next review">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="mt-10 overflow-hidden"
          ref={emblaRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Reviews from early traders"
        >
          <ul className="-ml-4 flex touch-pan-y py-2">
            {REVIEWS.map((review, index) => (
              <li
                key={review.name}
                className="min-w-0 shrink-0 grow-0 basis-full pl-4 sm:basis-1/2 lg:basis-1/3"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${REVIEWS.length}`}
              >
                <ReviewCard {...review} />
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="mt-8 flex justify-center gap-2">
          {snaps.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => embla?.scrollTo(index)}
              aria-label={`Go to review ${index + 1}`}
              aria-current={index === selected ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === selected ? "w-6 bg-brand" : "w-1.5 bg-line hover:bg-faint"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
