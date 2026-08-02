import { describe, expect, it, vi } from "vitest";
import { createTtlReadCache } from "./ttlReadCache";

describe("createTtlReadCache", () => {
  it("合併同時讀取並在 TTL 內重用一次成功結果", async () => {
    const loader = vi.fn(async () => ["latest"]);
    const cache = createTtlReadCache<string[]>({ ttlMs: 60_000 });
    const [first, second] = await Promise.all([cache.read(loader), cache.read(loader)]);
    const third = await cache.read(loader);
    expect(first).toEqual(["latest"]);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(loader).toHaveBeenCalledOnce();
  });

  it("配額錯誤時沿用最近成功資料，其他錯誤仍正常拋出", async () => {
    vi.useFakeTimers();
    const cache = createTtlReadCache<string[]>({
      ttlMs: 60_000,
      canUseStaleOnError: error => (error as Error).message.includes("quota"),
    });
    await cache.read(async () => ["cached"]);
    vi.advanceTimersByTime(60_001);
    await expect(cache.read(async () => { throw new Error("quota exceeded"); })).resolves.toEqual(["cached"]);
    await expect(cache.read(async () => { throw new Error("permission denied"); })).rejects.toThrow("permission denied");
    vi.useRealTimers();
  });
});
