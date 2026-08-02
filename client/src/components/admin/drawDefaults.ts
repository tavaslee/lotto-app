import type { LotteryType } from "@shared/lottery";

export function incrementLotteryIssue(issue: string | null | undefined): string {
  const trimmed = issue?.trim() ?? "";
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return "";
  const digits = match[2];
  return `${match[1]}${(BigInt(digits) + BigInt(1)).toString().padStart(digits.length, "0")}`;
}

export function getNextIssueFromLatest(latest: { issue: string } | null | undefined): string {
  return latest ? incrementLotteryIssue(latest.issue) : "";
}

export function getDefaultDrawDateRoc(_lotteryType: LotteryType, now = new Date()): string {
  const target = now;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${String(Number(value("year")) - 1911).padStart(3, "0")}.${value("month")}.${value("day")}`;
}
