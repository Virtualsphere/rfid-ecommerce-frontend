"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ProductSummary } from "@/lib/products";
import { useMotionOk } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/page-container";

/** How fast the rail drifts, in CSS pixels per second (about one card every five seconds). */
const DRIFT_PX_PER_SECOND = 60;

/** The length of one full pass of the rail: from a card to its clone. */
const loopWidth = (rail: HTMLElement, count: number) =>
  (rail.children[count] as HTMLElement).offsetLeft - (rail.children[0] as HTMLElement).offsetLeft;

/**
 * A horizontal rail of product cards that runs off the right edge of the page
 * while its first card lines up with the content column.
 *
 * Scrolls natively (touch, trackpad, shift-wheel, keyboard via the cards'
 * links); the prev/next buttons exist for mouse users, whom a hidden
 * scrollbar would otherwise leave with no way to see past the first cards.
 *
 * While it's on screen the rail also drifts left by itself, continuously, as a
 * seamless loop: a second, identical set of cards follows the first, and the
 * scroll position jumps back one set's width at the moment the two line up, so
 * nothing visibly moves. It holds still while the pointer is over it or
 * keyboard focus is inside it, and picks up again from the same spot. Scrolling
 * it by hand or with the buttons takes over from wherever it is. It never moves
 * by itself for people who ask for reduced motion.
 */
export function ProductRail({ title, products }: { title: string; products: ProductSummary[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  /**
   * The drift keeps its hands off the rail until `until` (performance.now clock)
   * or, when there's a `target`, until the rail gets there — whichever is first.
   */
  const holding = useRef<{ until: number; target: number | null }>({ until: 0, target: null });
  const [edges, setEdges] = useState({ start: true, end: false });
  /** The cards span at least the viewport, so a second set can fill the loop. */
  const [fits, setFits] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const motionOk = useMotionOk();
  const headingId = useId();
  const count = products.length;
  const loop = motionOk && fits;

  const measureEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    // Same values → same object, so the per-frame scroll events while drifting don't re-render.
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  const measureFit = useCallback(() => {
    const el = scroller.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const last = el?.children[count - 1] as HTMLElement | undefined;
    if (!el || !first || !last) return;
    setFits(last.offsetLeft + last.offsetWidth - first.offsetLeft >= el.clientWidth);
  }, [count]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measureEdges();
    measureFit();
    const onResize = () => {
      measureEdges();
      measureFit();
    };
    el.addEventListener("scroll", measureEdges, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", measureEdges);
      window.removeEventListener("resize", onResize);
    };
  }, [measureEdges, measureFit]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!loop || !inView || hovered || focused || !el) return;
    // `pos` is kept as a float: scrollLeft rounds to whole pixels, which at this
    // speed would swallow most frames' worth of movement.
    let pos = el.scrollLeft;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(now - last, 64); // a throttled tab shouldn't lurch forward
      last = now;
      const { until, target } = holding.current;
      const held = now < until && (target === null || Math.abs(el.scrollLeft - target) > 2);
      if (held || Math.abs(el.scrollLeft - pos) > 2) {
        // Someone else is moving the rail (wheel, touch, the buttons): follow it, don't fight it.
        // Writing scrollLeft would cancel their smooth scroll or fling, even on its first frame.
        pos = el.scrollLeft;
      } else {
        pos += (DRIFT_PX_PER_SECOND * elapsed) / 1000;
        const width = loopWidth(el, count);
        if (pos >= width) pos -= width;
        el.scrollLeft = pos;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loop, inView, hovered, focused, count]);

  const hold = (ms: number, target: number | null = null) => {
    holding.current = { until: performance.now() + ms, target };
  };

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    // Looping has no start to run into: step back from the clone, which looks identical.
    if (loop && direction === -1 && el.scrollLeft < el.clientWidth) el.scrollLeft += loopWidth(el, count);
    const left = direction * el.clientWidth * 0.8;
    // Smooth-scroll length varies by browser and frame rate, so wait for the destination, not a timer.
    hold(3000, Math.min(Math.max(el.scrollLeft + left, 0), el.scrollWidth - el.clientWidth));
    el.scrollBy({ left, behavior: motionOk ? "smooth" : "auto" });
  };

  return (
    <section
      aria-labelledby={headingId}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => setFocused((event.target as HTMLElement).matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      <PageContainer className="flex items-end justify-between gap-4">
        <h3 id={headingId} className="text-h3">
          {title}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous products"
            disabled={!loop && edges.start}
            onClick={() => page(-1)}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next products"
            disabled={!loop && edges.end}
            onClick={() => page(1)}
          >
            <ArrowRight />
          </Button>
        </div>
      </PageContainer>

      <ul
        ref={scroller}
        onWheel={(event) => {
          // Sideways wheel or trackpad swipe; a plain vertical wheel is just the page scrolling past.
          if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) hold(1000);
        }}
        onTouchStart={() => hold(Infinity)}
        onTouchEnd={() => hold(1500)} // let the fling finish
        onTouchCancel={() => hold(1500)}
        className={cn(
          "no-scrollbar mt-6 flex gap-4 overflow-x-auto scroll-px-4 px-4 pb-1 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100%_-_80rem)/2_+_2rem))] lg:px-[max(2rem,calc((100%_-_80rem)/2_+_2rem))]",
          // Snapping would pull the rail back to a card edge on every frame of the drift.
          !loop && "snap-x snap-mandatory"
        )}
      >
        {products.map((product) => (
          <li key={product._id} className="flex">
            <ProductCard product={product} variant="rail" />
          </li>
        ))}
        {loop &&
          products.map((product) => (
            <li key={`loop-${product._id}`} aria-hidden inert className="flex">
              <ProductCard product={product} variant="rail" />
            </li>
          ))}
      </ul>
    </section>
  );
}
