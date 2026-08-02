// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importWithSingleReload,
  isDynamicImportError,
} from "./lazyWithReload";

const RETRY_KEY = "test:admin-chunk-reload";

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("lazyWithReload", () => {
  it("辨識瀏覽器常見的動態模組與 chunk 載入錯誤", () => {
    expect(isDynamicImportError(new TypeError("Failed to fetch dynamically imported module: /assets/chunk.js"))).toBe(true);
    expect(isDynamicImportError(new Error("ChunkLoadError: Loading chunk 42 failed"))).toBe(true);
    expect(isDynamicImportError(new Error("一般表單驗證失敗"))).toBe(false);
  });

  it("載入成功後清除舊的單次重試標記", async () => {
    const reload = vi.fn();
    window.sessionStorage.setItem(RETRY_KEY, "1");

    await expect(importWithSingleReload(() => Promise.resolve("admin-module"), RETRY_KEY, reload)).resolves.toBe("admin-module");
    expect(window.sessionStorage.getItem(RETRY_KEY)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("首次動態匯入失敗時只標記並重新載入一次", async () => {
    const reload = vi.fn();
    void importWithSingleReload(
      () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/chunk.js")),
      RETRY_KEY,
      reload,
    );

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(RETRY_KEY)).toBe("1");
  });

  it("重試後仍失敗時拋出原錯誤，不形成無限重新整理", async () => {
    const reload = vi.fn();
    const error = new TypeError("Failed to fetch dynamically imported module: /assets/chunk.js");
    window.sessionStorage.setItem(RETRY_KEY, "1");

    await expect(importWithSingleReload(() => Promise.reject(error), RETRY_KEY, reload)).rejects.toBe(error);
    expect(reload).not.toHaveBeenCalled();
  });
});
