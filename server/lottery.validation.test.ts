import { describe, expect, it } from "vitest";
import { LOTTERY_CONFIG, type LotteryType } from "../shared/lottery";
import { validateDrawNumbers, validateSpecialNumber } from "./utils/lottery";

describe("lottery 6+1 model and color configuration", () => {
  it.each([
    ["lotto649", "#facc15"],
    ["superLotto638", "#16a34a"],
    ["markSix", "#dc2626"],
  ] as const)("configures %s as six basic numbers plus one special number", (type, color) => {
    const config = LOTTERY_CONFIG[type];
    expect(config.ballCount).toBe(6);
    expect(config.specialNumberRange).not.toBeNull();
    expect(config.accent).toBe(color);
    expect(validateDrawNumbers(type, [1, 2, 3, 4, 5, 6])).toHaveLength(6);
    expect(validateSpecialNumber(type, type === "superLotto638" ? 7 : 8, ["01", "02", "03", "04", "05", "06"])).not.toBeNull();
  });

  it("keeps 今彩539 at five orange basic balls without a special number", () => {
    expect(LOTTERY_CONFIG.daily539).toMatchObject({
      shortName: "今彩539",
      ballCount: 5,
      specialNumberRange: null,
      accent: "#f97316",
    });
    expect(validateSpecialNumber("daily539", null)).toBeNull();
  });

  it.each(["lotto649", "superLotto638", "markSix"] as LotteryType[])(
    "rejects a missing special number for %s",
    type => expect(() => validateSpecialNumber(type, null)).toThrow("必須輸入特別號"),
  );

  it("rejects a 威力彩 special number outside the independent 1～8 range", () => {
    expect(() => validateSpecialNumber("superLotto638", 9)).toThrow("1～8");
  });
});
