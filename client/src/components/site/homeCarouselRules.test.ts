import { describe, expect, it } from "vitest";
import {
  getCarouselAutoplayInterval,
  normalizeCarouselIndex,
  shouldRenderHomeCarousel,
  type HomeCarouselSettings,
} from "./homeCarouselRules";

const settings: HomeCarouselSettings = {
  isVisible: true,
  autoplay: true,
  intervalMs: 1500,
};

describe("home carousel rules", () => {
  it("renders only when display is enabled and at least one active slide exists", () => {
    expect(shouldRenderHomeCarousel(settings, 1)).toBe(true);
    expect(shouldRenderHomeCarousel({ ...settings, isVisible: false }, 1)).toBe(false);
    expect(shouldRenderHomeCarousel(settings, 0)).toBe(false);
    expect(shouldRenderHomeCarousel(undefined, 2)).toBe(false);
  });

  it("wraps previous and next manual navigation indexes", () => {
    expect(normalizeCarouselIndex(1, 3)).toBe(1);
    expect(normalizeCarouselIndex(3, 3)).toBe(0);
    expect(normalizeCarouselIndex(-1, 3)).toBe(2);
    expect(normalizeCarouselIndex(4, 0)).toBe(0);
  });

  it("starts autoplay only for a visible multi-slide carousel", () => {
    expect(getCarouselAutoplayInterval(settings, 2)).toBe(1500);
    expect(getCarouselAutoplayInterval({ ...settings, autoplay: false }, 2)).toBeNull();
    expect(getCarouselAutoplayInterval({ ...settings, isVisible: false }, 2)).toBeNull();
    expect(getCarouselAutoplayInterval(settings, 1)).toBeNull();
  });
});
