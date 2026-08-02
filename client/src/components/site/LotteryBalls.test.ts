import { describe, expect, it } from "vitest";
import {
  getLotteryBallLayoutClass,
  getLotteryBallSizeClass,
  LOTTERY_BALL_BASE_CLASS,
} from "./LotteryBalls";

describe("首頁彩球響應式排版", () => {
  it("手機縮小球體並放大數字，桌機維持既有球體與字級", () => {
    const classes = getLotteryBallSizeClass(false, true);
    expect(classes).toContain("size-9");
    expect(classes).toContain("text-lg");
    expect(classes).toContain("sm:size-10");
    expect(classes).toContain("sm:text-lg");
  });

  it("含特別號的最新開獎在手機平板維持單列，桌機保留六欄與第二列", () => {
    const classes = getLotteryBallLayoutClass(true, true);
    expect(classes).toContain("flex-nowrap");
    expect(classes).toContain("gap-1");
    expect(classes).toContain("xl:grid-cols-6");
    expect(getLotteryBallLayoutClass(true, false)).not.toContain("xl:grid-cols-6");
  });

  it("所有彩球都提供偽元素定位與裁切基準，避免光澤圓形溢出", () => {
    expect(LOTTERY_BALL_BASE_CLASS).toContain("relative");
    expect(LOTTERY_BALL_BASE_CLASS).toContain("overflow-hidden");
  });
});
