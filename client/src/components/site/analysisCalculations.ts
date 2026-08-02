import { LOTTERY_CONFIG, type DrawRecord, type LotteryType } from "@shared/lottery";

export type AnalysisRecord = Pick<
  DrawRecord,
  "id" | "issue" | "drawDateRoc" | "numbers" | "specialNumber"
>;

export function getMaxBall(lotteryType: LotteryType) {
  return LOTTERY_CONFIG[lotteryType].numberRanges[0].max;
}

export function getAnalysisNumbers(record: AnalysisRecord, includeSpecial: boolean) {
  const numbers = record.numbers.map(Number);
  if (includeSpecial && record.specialNumber) numbers.push(Number(record.specialNumber));
  return numbers;
}

export function buildDistributionStats(
  records: AnalysisRecord[],
  maxBall: number,
  includeSpecial: boolean,
) {
  const frequency = Array.from({ length: maxBall + 1 }, () => 0);
  for (const record of records) {
    for (const number of getAnalysisNumbers(record, includeSpecial)) frequency[number] += 1;
  }
  const sortedNumbers = Array.from({ length: maxBall }, (_, index) => index + 1).sort(
    (a, b) => frequency[b] - frequency[a] || a - b,
  );
  return { frequency: frequency.slice(1), sortedNumbers };
}

export function buildOddEvenRows(records: AnalysisRecord[], includeSpecial: boolean) {
  return records.map(record => {
    const numbers = getAnalysisNumbers(record, includeSpecial);
    const odd = numbers.filter(number => number % 2 === 1).length;
    return {
      id: record.id,
      issue: record.issue,
      drawDateRoc: record.drawDateRoc,
      numbers,
      odd,
      even: numbers.length - odd,
      sum: numbers.reduce((total, number) => total + number, 0),
    };
  });
}

export function buildHeadTailRows(
  records: AnalysisRecord[],
  maxBall: number,
  includeSpecial: boolean,
) {
  const headCount = Math.floor(maxBall / 10) + 1;
  return records.map(record => {
    const numbers = getAnalysisNumbers(record, includeSpecial);
    const heads = Array.from({ length: headCount }, () => 0);
    const tails = Array.from({ length: 10 }, () => 0);
    for (const number of numbers) {
      heads[Math.floor(number / 10)] += 1;
      tails[number % 10] += 1;
    }
    return { id: record.id, issue: record.issue, drawDateRoc: record.drawDateRoc, heads, tails };
  });
}

export type OmissionCell = { hit: boolean; value: number; trailing: boolean };
export type OmissionRow = {
  id: string;
  issue: string;
  drawDateRoc: string;
  cells: OmissionCell[];
};
export type NumberCountRanking = { number: number; count: number };

export function rankNumbersByCount(counts: number[], maxBall: number): NumberCountRanking[] {
  return Array.from({ length: maxBall }, (_, index) => ({
    number: index + 1,
    count: counts[index] ?? 0,
  })).sort((a, b) => b.count - a.count || a.number - b.number);
}

export function buildCurrentOmissionRanking(rows: OmissionRow[], maxBall: number) {
  const latestRow = rows[rows.length - 1];
  const counts = latestRow
    ? latestRow.cells.map(cell => (cell.hit ? 0 : cell.value))
    : Array.from({ length: maxBall }, () => 0);
  return rankNumbersByCount(counts, maxBall);
}

export function buildOmissionRows(
  records: AnalysisRecord[],
  maxBall: number,
  includeSpecial: boolean,
  omissionBeforeSelection: number[],
): OmissionRow[] {
  const lastHitIndex = Array.from({ length: maxBall + 1 }, () => -1);
  records.forEach((record, rowIndex) => {
    for (const number of getAnalysisNumbers(record, includeSpecial)) lastHitIndex[number] = rowIndex;
  });

  const current = Array.from(
    { length: maxBall + 1 },
    (_, index) => omissionBeforeSelection[index - 1] ?? 0,
  );
  return records.map((record, rowIndex) => {
    const hits = new Set(getAnalysisNumbers(record, includeSpecial));
    const cells = Array.from({ length: maxBall }, (_, index): OmissionCell => {
      const number = index + 1;
      if (hits.has(number)) {
        current[number] = 0;
        return { hit: true, value: number, trailing: false };
      }
      current[number] += 1;
      return { hit: false, value: current[number], trailing: rowIndex > lastHitIndex[number] };
    });
    return { id: record.id, issue: record.issue, drawDateRoc: record.drawDateRoc, cells };
  });
}
