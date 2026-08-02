import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", async importOriginal => {
  const actual = await importOriginal<typeof import("./storage")>();
  return { ...actual, storagePut: vi.fn() };
});

import { storagePut } from "./storage";
import { decodeCarouselImage, uploadCarouselImage } from "./services/carousel";

const signatures = [
  ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
  ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ["image/gif", Buffer.from("GIF89a", "ascii")],
  ["image/webp", Buffer.from("RIFF0000WEBP", "ascii")],
  ["image/avif", Buffer.from([0, 0, 0, 0, ...Buffer.from("ftypavif", "ascii")])],
] as const;

describe("carousel image service", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(signatures)("accepts a valid %s signature", (mimeType, bytes) => {
    expect(decodeCarouselImage(bytes.toString("base64"), mimeType)).toEqual(bytes);
  });

  it("accepts a data URL payload", () => {
    const bytes = signatures[1][1];
    expect(decodeCarouselImage(`data:image/png;base64,${bytes.toString("base64")}`, "image/png")).toEqual(bytes);
  });

  it("rejects unsupported and mismatched image content", () => {
    expect(() => decodeCarouselImage(signatures[1][1].toString("base64"), "image/svg+xml")).toThrow("僅支援");
    expect(() => decodeCarouselImage(signatures[1][1].toString("base64"), "image/jpeg")).toThrow("圖片內容與檔案格式不符");
  });

  it("rejects empty and oversized image payloads", () => {
    expect(() => decodeCarouselImage("", "image/png")).toThrow("圖片大小必須介於");
    expect(() => decodeCarouselImage(Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64"), "image/png")).toThrow("圖片大小必須介於");
  });

  it("stores a sanitized file name under the carousel prefix", async () => {
    vi.mocked(storagePut).mockResolvedValue({ key: "carousel-images/test.png", url: "/manus-storage/carousel-images/test.png" });
    const bytes = signatures[1][1];

    await expect(uploadCarouselImage({
      base64Data: bytes.toString("base64"),
      fileName: "廣告 圖片.png",
      mimeType: "image/png",
    })).resolves.toEqual({
      key: "carousel-images/test.png",
      url: "/manus-storage/carousel-images/test.png",
    });

    expect(storagePut).toHaveBeenCalledOnce();
    const [key, storedBytes, mimeType] = vi.mocked(storagePut).mock.calls[0];
    expect(key).toMatch(/^carousel-images\/\d+-_+\.png$/);
    expect(storedBytes).toEqual(bytes);
    expect(mimeType).toBe("image/png");
  });
});
