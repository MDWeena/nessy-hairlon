import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useGallery } from "../../hooks/useGallery";
import type { NavigateFn } from "../../types";
import { FadeIn } from "../ui/FadeIn";

interface StylesCarouselProps {
  navigate: NavigateFn;
}

const ROTATE_MS = 1500;

export function StylesCarousel({ navigate }: StylesCarouselProps) {
  const { entries } = useGallery();
  const images = entries.filter(e => e.imageUrl).slice(0, 6);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIndexRef = useRef(0);
  const pausedRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = (index: number) => {
    const track = trackRef.current;
    const slide = slideRefs.current[index];
    if (!track || !slide) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: "smooth" });
    activeIndexRef.current = index;
    setActiveIndex(index);
  };

  useEffect(() => {
    if (images.length < 2) return;
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      goTo((activeIndexRef.current + 1) % images.length);
    }, ROTATE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const handleScroll = () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      let closest = 0;
      let closestDiff = Infinity;
      slideRefs.current.forEach((slide, i) => {
        if (!slide) return;
        const diff = Math.abs((slide.offsetLeft - track.offsetLeft) - track.scrollLeft);
        if (diff < closestDiff) { closestDiff = diff; closest = i; }
      });
      activeIndexRef.current = closest;
      setActiveIndex(closest);
    }, 120);
  };

  if (images.length === 0) return null;

  return (
    <section className="py-[72px] px-6 max-w-[1000px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">RECENT WORK</p>
        <h2 className="font-cursive text-5xl font-bold mb-5 leading-[1.1]">
          This week's styles
        </h2>
        <p className="text-[15px] leading-[1.8] text-text-soft max-w-[560px] mb-8">
          A quick look at what's been happening in the chair lately.
        </p>
      </FadeIn>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((entry, i) => (
          <div
            key={entry.dayOfWeek} ref={(el) => { slideRefs.current[i] = el; }}
            onClick={() => navigate("gallery")}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("gallery"); }}
            className="hover-lift snap-center shrink-0 w-[85%] sm:w-[47%] lg:w-[31%] h-[280px] rounded-2xl overflow-hidden border border-border cursor-pointer relative"
            style={{ background: `url(${entry.imageUrl}) center/cover no-repeat` }}
          >
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.75),transparent)] py-4 px-4">
              <span className="text-white text-sm font-bold">{entry.styleName}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-6">
        {images.map((entry, i) => (
          <button
            key={entry.dayOfWeek} onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full border-none cursor-pointer [transition:all_0.2s] ${i === activeIndex ? "bg-gold w-6" : "bg-border w-2"}`}
          />
        ))}
      </div>

      <div className="text-center mt-6">
        <button
          onClick={() => navigate("gallery")}
          className="bg-transparent border-none cursor-pointer text-gold text-sm font-semibold inline-flex items-center gap-1.5"
        >See full gallery <ArrowRight size={15} /></button>
      </div>
    </section>
  );
}
