import { storagePut } from "../storage";

export const CAROUSEL_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

const ALLOWED_IMAGE_TYPES = new Set<string>(CAROUSEL_IMAGE_TYPES);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const hasExpectedSignature = (bytes: Buffer, mimeType: string) => {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "image/avif") return bytes.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(bytes.subarray(8, 12).toString("ascii"));
  return false;
};

export function decodeCarouselImage(base64Data: string, mimeType: string) {
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("僅支援 JPG、PNG、WebP、GIF 與 AVIF 圖片");
  const cleaned = base64Data.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(cleaned, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("圖片大小必須介於 1 byte 與 8 MB 之間");
  if (!hasExpectedSignature(bytes, mimeType)) throw new Error("圖片內容與檔案格式不符");
  return bytes;
}

export async function uploadCarouselImage(input: { base64Data: string; fileName: string; mimeType: string }) {
  const bytes = decodeCarouselImage(input.base64Data, input.mimeType);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "carousel-image";
  return storagePut(`carousel-images/${Date.now()}-${safeName}`, bytes, input.mimeType);
}
