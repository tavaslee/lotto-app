import { storagePut } from "../storage";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function uploadTrendImage(input: {
  base64Data: string;
  fileName: string;
  mimeType: string;
  lotteryType: string;
}) {
  if (!ALLOWED_IMAGE_TYPES.has(input.mimeType)) {
    throw new Error("僅支援 JPG、PNG、WebP、GIF 與 AVIF 圖片");
  }
  const cleaned = input.base64Data.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(cleaned, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("圖片大小必須介於 1 byte 與 8 MB 之間");
  }
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "image";
  return storagePut(`trend-images/${input.lotteryType}/${Date.now()}-${safeName}`, bytes, input.mimeType);
}

export function validateExternalImageUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("圖片網址必須使用 http 或 https");
  }
  return url.toString();
}
