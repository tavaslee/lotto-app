import { describe, expect, it } from "vitest";
import { normalizeRocDate, parseRapidInput } from "./DrawManagement";
import { getDefaultDrawDateRoc, getNextIssueFromLatest, incrementLotteryIssue } from "./drawDefaults";

describe("後台開獎資料解析", () => {
  it("將連續兩位數輸入解析成大樂透六個一般號碼", () => {
    expect(parseRapidInput("lotto649", "010812233541")).toEqual([
      "01",
      "08",
      "12",
      "23",
      "35",
      "41",
    ]);
  });

  it("支援以空白或逗號分隔的今彩 539 五個號碼", () => {
    expect(parseRapidInput("daily539", "1, 8 12，23、39")).toEqual([
      "01",
      "08",
      "12",
      "23",
      "39",
    ]);
  });

  it("將威力彩六個一般號碼與獨立特別號分開輸入，並拒絕重複一般號", () => {
    expect(parseRapidInput("superLotto638", "010812233538")).toEqual([
      "01",
      "08",
      "12",
      "23",
      "35",
      "38",
    ]);
    expect(() => parseRapidInput("superLotto638", "010112233538")).toThrow("不可重複");
  });

  it("將民國與西元日期統一成民國三位數格式", () => {
    expect(normalizeRocDate("115.7.8")).toBe("115.07.08");
    expect(normalizeRocDate("2026/07/08")).toBe("115.07.08");
  });

  it("拒絕不存在的日期", () => {
    expect(() => normalizeRocDate("115.02.30")).toThrow("不是有效日期");
  });

  it("以真正最新期數加一，保留前綴與補零；無最新資料或查詢失敗時不使用舊期數回退", () => {
    expect(incrementLotteryIssue("115000099")).toBe("115000100");
    expect(incrementLotteryIssue("L-0099")).toBe("L-0100");
    expect(getNextIssueFromLatest({ issue: "115000120" })).toBe("115000121");
    expect(getNextIssueFromLatest(null)).toBe("");
    expect(getNextIssueFromLatest(undefined)).toBe("");
  });

  it("五個彩別皆預設選擇當天的台灣民國日期", () => {
    const inputTime = new Date("2026-07-21T01:30:00.000Z");
    expect(getDefaultDrawDateRoc("lotto649", inputTime)).toBe("115.07.21");
    expect(getDefaultDrawDateRoc("superLotto638", inputTime)).toBe("115.07.21");
    expect(getDefaultDrawDateRoc("daily539", inputTime)).toBe("115.07.21");
    expect(getDefaultDrawDateRoc("markSix", inputTime)).toBe("115.07.21");
    expect(getDefaultDrawDateRoc("fantasy5", inputTime)).toBe("115.07.21");
  });

  it("加州天天樂跨 UTC 日界時仍帶入台灣當天 115.07.31", () => {
    const inputTime = new Date("2026-07-30T16:30:00.000Z");
    expect(getDefaultDrawDateRoc("fantasy5", inputTime)).toBe("115.07.31");
  });
});
