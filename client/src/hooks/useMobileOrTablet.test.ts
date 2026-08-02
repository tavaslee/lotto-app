import { describe, expect, it } from "vitest";
import { detectMobileOrTablet } from "./useMobileOrTablet";

describe("detectMobileOrTablet", () => {
  it("辨識手機、平板與緊湊視窗，寬版桌機維持桌機版", () => {
    expect(detectMobileOrTablet({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile", platform: "iPhone", maxTouchPoints: 5, coarsePointer: true, viewportWidth: 390 })).toBe(true);
    expect(detectMobileOrTablet({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", platform: "iPad", maxTouchPoints: 5, coarsePointer: true, viewportWidth: 1024 })).toBe(true);
    expect(detectMobileOrTablet({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 0, coarsePointer: false, viewportWidth: 1024 })).toBe(true);
    expect(detectMobileOrTablet({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 0, coarsePointer: false, viewportWidth: 1440 })).toBe(false);
  });
});
