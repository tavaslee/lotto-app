import { describe, expect, it } from "vitest";
import { getAnalysisDefaultRange, getHistoryDefaultRange } from "./dateRangeDefaults";

const now = new Date(2026, 6, 22, 12);
const regular = { role: "user", memberLevel: "regular" };
const premium = { role: "user", memberLevel: "premium" };
const admin = { role: "admin", memberLevel: "premium" };

describe("date range defaults", () => {
  it("首頁歷史查詢：訪客為當天，一般與付費會員為近 10 天", () => {
    expect(getHistoryDefaultRange(undefined, now)).toEqual({ fromDate: "2026-07-22", toDate: "2026-07-22" });
    expect(getHistoryDefaultRange(regular, now)).toEqual({ fromDate: "2026-07-12", toDate: "2026-07-22" });
    expect(getHistoryDefaultRange(premium, now)).toEqual({ fromDate: "2026-07-12", toDate: "2026-07-22" });
  });

  it("分析工具：訪客為近 10 天，一般與付費會員為近 30 天", () => {
    expect(getAnalysisDefaultRange(undefined, now)).toEqual({ fromDate: "2026-07-12", toDate: "2026-07-22" });
    expect(getAnalysisDefaultRange(regular, now)).toEqual({ fromDate: "2026-06-22", toDate: "2026-07-22" });
    expect(getAnalysisDefaultRange(premium, now)).toEqual({ fromDate: "2026-06-22", toDate: "2026-07-22" });
  });

  it("未指定修改的管理員日期預設維持既有區間", () => {
    expect(getHistoryDefaultRange(admin, now)).toEqual({ fromDate: "2026-04-23", toDate: "2026-07-22" });
    expect(getAnalysisDefaultRange(admin, now)).toEqual({ fromDate: "2025-07-22", toDate: "2026-07-22" });
  });
});
