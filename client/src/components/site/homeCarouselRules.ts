export type HomeCarouselSettings = {
  isVisible: boolean;
  autoplay: boolean;
  intervalMs: number;
};

export function shouldRenderHomeCarousel(
  settings: HomeCarouselSettings | null | undefined,
  slideCount: number,
) {
  return Boolean(settings?.isVisible && slideCount > 0);
}

export function normalizeCarouselIndex(index: number, slideCount: number) {
  if (slideCount <= 0) return 0;
  return ((index % slideCount) + slideCount) % slideCount;
}

export function getCarouselAutoplayInterval(
  settings: HomeCarouselSettings | null | undefined,
  slideCount: number,
) {
  if (!settings?.isVisible || !settings.autoplay || slideCount < 2) return null;
  return Number.isFinite(settings.intervalMs) && settings.intervalMs > 0
    ? settings.intervalMs
    : null;
}
