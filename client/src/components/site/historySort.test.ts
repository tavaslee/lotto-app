import { describe, expect, it } from "vitest";
import { LOTTERY_TYPES, type DrawRecord, type LotteryType } from "@shared/lottery";
import { sortHistoryDraws, sortHistoryDrawsOldestFirst } from "./historySort";

function draw(lotteryType: LotteryType, issue: string, drawDateIso: string): DrawRecord {
  return {
    id: `${lotteryType}-${issue}`,
    lotteryType,
    issue,
    drawDateRoc: drawDateIso,
    drawDateIso,
    numbers: ["01", "02", "03", "04", "05"],
    specialNumber: null,
    status: "active",
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

describe("sortHistoryDrawsOldestFirst", () => {
  it.each(LOTTERY_TYPES)("讓 %s 的最舊一期在最上、最新一期在最下", lotteryType => {
    const newest = draw(lotteryType, "202600010", "2026-07-03");
    const oldest = draw(lotteryType, "202600008", "2026-07-01");
    const middle = draw(lotteryType, "202600009", "2026-07-02");
    const apiOrder = [newest, oldest, middle];

    expect(sortHistoryDrawsOldestFirst(apiOrder).map(record => record.issue)).toEqual([
      oldest.issue,
      middle.issue,
      newest.issue,
    ]);
    expect(apiOrder.map(record => record.issue)).toEqual([newest.issue, oldest.issue, middle.issue]);
  });

  it("同一開獎日期依數字期數由小到大排列", () => {
    const lotteryType = "lotto649";
    const laterIssue = draw(lotteryType, "10", "2026-07-01");
    const earlierIssue = draw(lotteryType, "9", "2026-07-01");

    expect(sortHistoryDrawsOldestFirst([laterIssue, earlierIssue]).map(record => record.issue)).toEqual([
      "9",
      "10",
    ]);
  });

  it.each(LOTTERY_TYPES)("讓 %s 可切換為最新一期在最上", lotteryType => {
    const newest = draw(lotteryType, "202600010", "2026-07-03");
    const oldest = draw(lotteryType, "202600008", "2026-07-01");
    const middle = draw(lotteryType, "202600009", "2026-07-02");

    expect(sortHistoryDraws([newest, oldest, middle], "newest").map(record => record.issue)).toEqual([
      newest.issue,
      middle.issue,
      oldest.issue,
    ]);
  });
});
