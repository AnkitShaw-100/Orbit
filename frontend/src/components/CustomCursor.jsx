import { useEffect, useRef, useState } from "react";

const INTERACTIVE = 'a, button, input, [role="button"], [data-cursor="hover"]';

/**
 * A lilac dart pointer with depth: gradient shading, a lit top edge, stacked
 * shadows, and a tilt driven by how fast you're moving. The tilt is what sells
 * the 3D feel — a flat shape that never reacts reads as a sticker.
 */
export default function CustomCursor() {
  const wrapRef = useRef(null);
  const tiltRef = useRef(null);
  const [enabled, setEnabled] = useState(() => window.matchMedia("(pointer: fine)").matches);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const onPointerChange = (event) => setEnabled(event.matches);
    finePointer.addEventListener("change", onPointerChange);
    return () => finePointer.removeEventListener("change", onPointerChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.classList.add("orbit-cursor");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let frame;

    const onMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      }
    };

    // Velocity is smoothed rather than read raw, so the tilt eases back to rest
    // instead of snapping the moment the pointer stops.
    const render = () => {
      velocity.x += (pointer.x - last.x - velocity.x) * 0.2;
      velocity.y += (pointer.y - last.y - velocity.y) * 0.2;
      last = { x: pointer.x, y: pointer.y };

      if (tiltRef.current && !reduceMotion) {
        const tiltY = Math.max(-22, Math.min(22, velocity.x * 1.4));
        const tiltX = Math.max(-22, Math.min(22, -velocity.y * 1.4));
        tiltRef.current.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      }

      frame = requestAnimationFrame(render);
    };

    const onOver = (event) => setHovering(Boolean(event.target.closest?.(INTERACTIVE)));
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    frame = requestAnimationFrame(render);

    return () => {
      document.documentElement.classList.remove("orbit-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  const scale = pressed ? 0.8 : hovering ? 1.3 : 1;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-9999 overflow-hidden">
      <div ref={wrapRef} className="absolute left-0 top-0 will-change-transform">
        <div style={{ perspective: "260px" }}>
          <div ref={tiltRef} className="origin-top-left will-change-transform">
            <svg
              width="30"
              height="32"
              viewBox="0 0 18 19"
              fill="none"
              className="origin-top-left transition-transform duration-200 ease-out"
              style={{ transform: `scale(${scale})` }}
            >
              <defs>
                <linearGradient id="orbit-cursor-face" x1="0" y1="0" x2="0.9" y2="1">
                  <stop offset="0%" stopColor="#B49CFB" />
                  <stop offset="100%" stopColor="#9B7DF6" />
                </linearGradient>
              </defs>

              {/* Stroked in its own fill colour with round joins, which rounds
                  the silhouette's corners without changing the shape. */}
              <path
                d="M2.4 2.4 L15.4 8.8 L8.8 10.6 L5.9 16.4 Z"
                fill="url(#orbit-cursor-face)"
                stroke="url(#orbit-cursor-face)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
