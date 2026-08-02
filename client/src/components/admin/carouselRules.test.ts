import { describe, expect, it } from "vitest";
import {
  ACCEPTED_CAROUSEL_TYPES,
  MAX_CAROUSEL_IMAGE_BYTES,
  getCarouselFileValidationError,
  isValidCarouselInterval,
} from "./carouselRules";

describe("carousel management rules", () => {
  it.each(ACCEPTED_CAROUSEL_TYPES)("accepts %s uploads", type => {
    expect(getCarouselFileValidationError({ type, size: 1024 })).toBeNull();
  });

  it("rejects unsupported, empty, and oversized uploads", () => {
    expect(getCarouselFileValidationError({ type: "image/svg+xml", size: 1024 })).toBe("type");
    expect(getCarouselFileValidationError({ type: "image/png", size: 0 })).toBe("size");
    expect(getCarouselFileValidationError({ type: "image/png", size: MAX_CAROUSEL_IMAGE_BYTES + 1 })).toBe("size");
  });

  it.each([0.5, 1, 1.5, 9.5, 10])("accepts a %s-second interval", seconds => {
    expect(isValidCarouselInterval(seconds)).toBe(true);
  });

  it.each([0, 0.4, 0.6, 10.5, Number.NaN])("rejects an invalid %s-second interval", seconds => {
    expect(isValidCarouselInterval(seconds)).toBe(false);
  });
});
