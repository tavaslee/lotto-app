export const ACCEPTED_CAROUSEL_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const MAX_CAROUSEL_IMAGE_BYTES = 8 * 1024 * 1024;

export function getCarouselFileValidationError(file: { type: string; size: number }) {
  if (!ACCEPTED_CAROUSEL_TYPES.includes(file.type as typeof ACCEPTED_CAROUSEL_TYPES[number])) return "type" as const;
  if (file.size < 1 || file.size > MAX_CAROUSEL_IMAGE_BYTES) return "size" as const;
  return null;
}

export function isValidCarouselInterval(seconds: number) {
  return Number.isFinite(seconds)
    && seconds >= 0.5
    && seconds <= 10
    && Number.isInteger(seconds * 2);
}
