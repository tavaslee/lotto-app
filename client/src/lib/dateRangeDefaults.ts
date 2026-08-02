type DateRangeUser = {
  role: string;
  memberLevel: string;
} | null | undefined;

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeFromDays(days: number, now: Date) {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { fromDate: localDate(from), toDate: localDate(to) };
}

export function getHistoryDefaultRange(user: DateRangeUser, now = new Date()) {
  if (!user) return rangeFromDays(0, now);
  return rangeFromDays(user.role === "admin" ? 90 : 10, now);
}

export function getAnalysisDefaultRange(user: DateRangeUser, now = new Date()) {
  if (!user) return rangeFromDays(10, now);
  if (user.role !== "admin") return rangeFromDays(30, now);

  const to = new Date(now);
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  return { fromDate: localDate(from), toDate: localDate(to) };
}
