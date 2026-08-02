import type { DrawRecord } from "@shared/lottery";

export type HistorySortDirection = "oldest" | "newest";

export function sortHistoryDraws(
  records: readonly DrawRecord[],
  direction: HistorySortDirection = "oldest",
): DrawRecord[] {
  return [...records].sort((left, right) => {
    const dateComparison = left.drawDateIso.localeCompare(right.drawDateIso);
    const comparison = dateComparison !== 0
      ? dateComparison
      : left.issue.localeCompare(right.issue, "zh-Hant", {
          numeric: true,
          sensitivity: "base",
        });

    return direction === "oldest" ? comparison : -comparison;
  });
}

export function sortHistoryDrawsOldestFirst(records: readonly DrawRecord[]): DrawRecord[] {
  return sortHistoryDraws(records, "oldest");
}
