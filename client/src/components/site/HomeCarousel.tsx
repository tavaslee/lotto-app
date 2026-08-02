import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import {
  getCarouselAutoplayInterval,
  normalizeCarouselIndex,
  shouldRenderHomeCarousel,
} from "./homeCarouselRules";
import { GestureImageViewer } from "./GestureImageViewer";

export function HomeCarousel() {
  const { data } = trpc.carousel.publicView.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const slides = data?.slides ?? [];
  const settings = data?.settings;
  const autoplayInterval = getCarouselAutoplayInterval(settings, slides.length);

  useEffect(() => {
    setActiveIndex(index => slides.length ? Math.min(index, slides.length - 1) : 0);
  }, [slides.length]);

  useEffect(() => {
    if (autoplayInterval === null || viewerOpen) return;
    const timer = window.setInterval(
      () => setActiveIndex(index => (index + 1) % slides.length),
      autoplayInterval,
    );
    return () => window.clearInterval(timer);
  }, [autoplayInterval, slides.length, viewerOpen]);

  if (!data) {
    return (
      <section
        aria-label="首頁廣告輪播載入中"
        className="aspect-[16/7] w-full animate-pulse rounded-3xl bg-stone-200 sm:aspect-[3/1]"
      />
    );
  }
  if (!shouldRenderHomeCarousel(settings, slides.length)) return null;
  const activeSlide = slides[activeIndex] ?? slides[0];
  const hasMultipleSlides = slides.length > 1;

  const showSlide = (index: number) => {
    setActiveIndex(normalizeCarouselIndex(index, slides.length));
  };

  return (
    <>
    <section
      className="group relative isolate overflow-hidden rounded-3xl bg-stone-900 shadow-xl shadow-stone-950/10 ring-1 ring-black/5"
      aria-roledescription="輪播"
      aria-label="首頁廣告輪播"
    >
      <button
        type="button"
        aria-label="放大目前輪播圖片"
        className="relative block aspect-[16/7] w-full touch-pan-y sm:aspect-[3/1]"
        onPointerDown={event => {
          if (event.pointerType !== "mouse") swipeStartRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={event => {
          const start = swipeStartRef.current;
          swipeStartRef.current = null;
          if (!start || !hasMultipleSlides) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.15) {
            didSwipeRef.current = true;
            showSlide(activeIndex + (dx < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => { swipeStartRef.current = null; }}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          setViewerOpen(true);
        }}
      >
        <img
          key={activeSlide.id}
          src={activeSlide.url}
          alt={activeSlide.fileName.replace(/\.[^.]+$/, "") || `輪播圖片 ${activeIndex + 1}`}
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
      </button>

      {hasMultipleSlides ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="上一張輪播圖片"
            onClick={() => showSlide((activeIndex - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm hover:bg-black/65 hover:text-white sm:inline-flex sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="下一張輪播圖片"
            onClick={() => showSlide((activeIndex + 1) % slides.length)}
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm hover:bg-black/65 hover:text-white sm:inline-flex sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <ChevronRight className="size-5" />
          </Button>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" aria-label={`第 ${activeIndex + 1} 張，共 ${slides.length} 張`}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`顯示第 ${index + 1} 張圖片`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => showSlide(index)}
                className={index === activeIndex
                  ? "h-2 w-7 rounded-full bg-white shadow-sm transition-[width] duration-200"
                  : "size-2 rounded-full bg-white/55 transition-colors hover:bg-white"}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
    <GestureImageViewer
      open={viewerOpen}
      src={activeSlide.url}
      alt={activeSlide.fileName.replace(/\.[^.]+$/, "") || `輪播圖片 ${activeIndex + 1}`}
      onClose={() => setViewerOpen(false)}
    />
    </>
  );
}
