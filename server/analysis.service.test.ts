import { describe, expect, it } from "vitest";
import type { DrawRecord } from "../shared/lottery";
import { calculateOmissionContext } from "./services/analysis";

function record(id: string, issue: string, numbers: string[]): DrawRecord {
  return {
    id,
    lotteryType: "lotto649",
    issue,
    drawDateRoc: `115.01.0${issue}`,
    drawDateIso: `2026-01-0${issue}`,
    numbers,
    specialNumber: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("analysis omission context", () => {
  it("returns omission counts before the selected range and all-history maximums", () => {
    const oldest = record("old", "1", ["02"]);
    const middle = record("mid", "2", ["01"]);
    const newest = record("new", "3", ["02"]);
    const result = calculateOmissionContext([newest, middle, oldest], [newest, middle], false);
    expect(result.omissionBeforeSelection.slice(0, 2)).toEqual([1, 0]);
    expect(result.maxOmission.slice(0, 2)).toEqual([1, 1]);
  });
});
