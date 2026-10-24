"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ProductSummary } from "@/lib/products";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/page-container";

/** How long the rail sits on screen (or after a pause ends) before it first moves. */
const AUTOPLAY_FIRST_MS = 1500;
/** Gap between later steps — long enough to read a card before it slides away. */
const AUTOPLAY_STEP_MS = 3000;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A horizontal rail of product cards that runs off the right edge of the page
 * while its first card lines up with the content column.
 *
 * Scrolls natively (touch, trackpad, shift-wheel, keyboard via the cards'
 * links); the prev/next buttons exist for mouse users, whom a hidden
 * scrollbar would otherwise leave with no way to see past the first cards.
 *
 * Once the rail has been on screen for a moment it also advances by itself, a
 * card at a time, and wraps back to the start. It stops while the pointer is
 * over it or focus is inside it, and never runs for people who ask for reduced
 * motion — they still have the buttons and native scroll.
 */
export function ProductRail({ title, products }: { title: string; products: ProductSummary[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const headingId = useId();

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const paused = hovered || focused;

  useEffect(() => {
    if (!inView || paused || prefersReducedMotion()) return;
    const advance = () => {
      const el = scroller.current;
      if (!el) return;
      const [first, second] = Array.from(el.children) as HTMLElement[];
      if (!first || !second) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: second.offsetLeft - first.offsetLeft, behavior: "smooth" });
    };
    let timer: number;
    const tick = () => {
      advance();
      timer = window.setTimeout(tick, AUTOPLAY_STEP_MS);
    };
    timer = window.setTimeout(tick, AUTOPLAY_FIRST_MS);
    return () => window.clearTimeout(timer);
  }, [inView, paused]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section
      aria-labelledby={headingId}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <PageContainer className="flex items-end justify-between gap-4">
        <h3 id={headingId} className="text-h3">
          {title}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Previous products" disabled={edges.start} onClick={() => page(-1)}>
            <ArrowLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next products" disabled={edges.end} onClick={() => page(1)}>
            <ArrowRight />
          </Button>
        </div>
      </PageContainer>

      <ul
        ref={scroller}
        className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-1 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100%_-_80rem)/2_+_2rem))] lg:px-[max(2rem,calc((100%_-_80rem)/2_+_2rem))]"
      >
        {products.map((product) => (
          <li key={product._id} className="flex">
            <ProductCard product={product} variant="rail" />
          </li>
        ))}
      </ul>
    </section>
  );
}
