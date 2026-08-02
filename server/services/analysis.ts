import { LOTTERY_CONFIG, type DrawRecord } from "../../shared/lottery";

function drawnNumbers(record: DrawRecord, includeSpecial: boolean) {
  const values = record.numbers.map(Number);
  if (includeSpecial && record.specialNumber) values.push(Number(record.specialNumber));
  return new Set(values);
}

export function calculateOmissionContext(
  allRecordsDescending: DrawRecord[],
  selectedRecordsDescending: DrawRecord[],
  includeSpecial: boolean,
) {
  const maxBall = LOTTERY_CONFIG[allRecordsDescending[0]?.lotteryType ?? selectedRecordsDescending[0]?.lotteryType ?? "lotto649"].numberRanges[0].max;
  const current = Array.from({ length: maxBall + 1 }, () => 0);
  const maximum = Array.from({ length: maxBall + 1 }, () => 0);
  const oldestSelectedId = selectedRecordsDescending.at(-1)?.id;
  let omissionBeforeSelection = current.slice();

  for (const record of allRecordsDescending.toReversed()) {
    if (record.id === oldestSelectedId) omissionBeforeSelection = current.slice();
    const hits = drawnNumbers(record, includeSpecial);
    for (let number = 1; number <= maxBall; number += 1) {
      current[number] = hits.has(number) ? 0 : current[number] + 1;
      maximum[number] = Math.max(maximum[number], current[number]);
    }
  }

  return {
    omissionBeforeSelection: omissionBeforeSelection.slice(1),
    maxOmission: maximum.slice(1),
  };
}
