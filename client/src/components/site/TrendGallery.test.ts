import { describe, expect, it } from "vitest";
import { clampImageScale, pointDistance } from "./GestureImageViewer";

describe("版路圖片自然手勢計算", () => {
  it("將縮放倍率限制在 1 到 5 倍", () => {
    expect(clampImageScale(0.25)).toBe(1);
    expect(clampImageScale(2.5)).toBe(2.5);
    expect(clampImageScale(8)).toBe(5);
  });

  it("正確計算雙指距離", () => {
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
