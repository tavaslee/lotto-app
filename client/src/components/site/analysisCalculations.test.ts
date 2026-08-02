import { describe, expect, it } from "vitest";
import {
  buildCurrentOmissionRanking,
  buildDistributionStats,
  buildHeadTailRows,
  buildOddEvenRows,
  buildOmissionRows,
  rankNumbersByCount,
  type AnalysisRecord,
} from "./analysisCalculations";

const records: AnalysisRecord[] = [
  { id: "1", issue: "001", drawDateRoc: "115.01.01", numbers: ["01", "05", "10", "16", "27", "34"], specialNumber: "07" },
  { id: "2", issue: "002", drawDateRoc: "115.01.02", numbers: ["01", "02", "03", "04", "05", "06"], specialNumber: "08" },
];

describe("analysis calculations", () => {
  it("computes distribution frequency and stable descending rank with optional special number", () => {
    const withoutSpecial = buildDistributionStats(records, 49, false);
    const withSpecial = buildDistributionStats(records, 49, true);
    expect(withoutSpecial.frequency[0]).toBe(2);
    expect(withoutSpecial.frequency[6]).toBe(0);
    expect(withSpecial.frequency[6]).toBe(1);
    expect(withSpecial.frequency[7]).toBe(1);
    expect(withSpecial.sortedNumbers.slice(0, 2)).toEqual([1, 5]);
  });

  it("computes odd/even ratio and sum with the special number only when selected", () => {
    expect(buildOddEvenRows(records.slice(0, 1), false)[0]).toMatchObject({ odd: 3, even: 3, sum: 93 });
    expect(buildOddEvenRows(records.slice(0, 1), true)[0]).toMatchObject({ odd: 4, even: 3, sum: 100 });
  });

  it("computes 0-4 heads and 0-9 tails for a 49-number lottery", () => {
    const row = buildHeadTailRows(records.slice(0, 1), 49, true)[0];
    expect(row.heads).toEqual([3, 2, 1, 1, 0]);
    expect(row.tails[7]).toBe(2);
  });

  it("continues omission counts from before the selected range and marks only the trailing run", () => {
    const omissionRecords: AnalysisRecord[] = [
      { id: "a", issue: "1", drawDateRoc: "115.01.01", numbers: ["02"], specialNumber: null },
      { id: "b", issue: "2", drawDateRoc: "115.01.02", numbers: ["01"], specialNumber: null },
      { id: "c", issue: "3", drawDateRoc: "115.01.03", numbers: ["02"], specialNumber: null },
    ];
    const rows = buildOmissionRows(omissionRecords, 2, false, [3, 0]);
    expect(rows[0].cells[0]).toEqual({ hit: false, value: 4, trailing: false });
    expect(rows[1].cells[0]).toEqual({ hit: true, value: 1, trailing: false });
    expect(rows[2].cells[0]).toEqual({ hit: false, value: 1, trailing: true });
  });

  it("ranks historical and current omission counts descending with number as the stable tiebreaker", () => {
    expect(rankNumbersByCount([3, 5, 5, 1], 4)).toEqual([
      { number: 2, count: 5 },
      { number: 3, count: 5 },
      { number: 1, count: 3 },
      { number: 4, count: 1 },
    ]);

    const omissionRecords: AnalysisRecord[] = [
      { id: "a", issue: "1", drawDateRoc: "115.01.01", numbers: ["02"], specialNumber: null },
      { id: "b", issue: "2", drawDateRoc: "115.01.02", numbers: ["01"], specialNumber: null },
      { id: "c", issue: "3", drawDateRoc: "115.01.03", numbers: ["02"], specialNumber: null },
    ];
    const rows = buildOmissionRows(omissionRecords, 2, false, [3, 0]);
    expect(buildCurrentOmissionRanking(rows, 2)).toEqual([
      { number: 1, count: 1 },
      { number: 2, count: 0 },
    ]);
  });
});
