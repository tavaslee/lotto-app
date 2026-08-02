import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHistoryDefaultRange } from "@/lib/dateRangeDefaults";
import { trpc } from "@/lib/trpc";
import type { MemberSession } from "@/types/member";
import { LOTTERY_CONFIG, type LotteryType } from "@shared/lottery";
import { ArrowDownUp, CalendarRange, Crown, History, LockKeyhole, Search } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { sortHistoryDraws, type HistorySortDirection } from "./historySort";
import { LotteryBalls } from "./LotteryBalls";

export function HistoryTable({
  lotteryType,
  session,
  onOpenMember,
}: {
  lotteryType: LotteryType;
  session: MemberSession | undefined;
  onOpenMember: () => void;
}) {
  const defaultRange = useMemo(
    () => getHistoryDefaultRange(session?.user),
    [session?.user?.id, session?.user?.memberLevel, session?.user?.role],
  );
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [submitted, setSubmitted] = useState({ fromDate, toDate });
  const [sortDirection, setSortDirection] = useState<HistorySortDirection>("oldest");

  useEffect(() => {
    setFromDate(defaultRange.fromDate);
    setToDate(defaultRange.toDate);
    setSubmitted(defaultRange);
  }, [defaultRange.fromDate, defaultRange.toDate]);

  const historyInput = useMemo(
    () => ({ lotteryType, fromDate: submitted.fromDate, toDate: submitted.toDate, limit: 500 }),
    [lotteryType, submitted],
  );
  const historyQuery = trpc.lottery.history.useQuery(historyInput, { enabled: Boolean(session?.user) });
  const historyRecords = useMemo(
    () => sortHistoryDraws(historyQuery.data ?? [], sortDirection),
    [historyQuery.data, sortDirection],
  );
  const isRegular = session?.user.role !== "admin" && session?.user.memberLevel === "regular";
  const lotteryConfig = LOTTERY_CONFIG[lotteryType];
  const sortLabel = sortDirection === "oldest" ? "舊到新" : "新到舊";
  const toggleSortDirection = () => {
    setSortDirection(current => current === "oldest" ? "newest" : "oldest");
  };
  const sortButton = (className: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`justify-start border-amber-200 bg-amber-50 font-black text-amber-900 shadow-sm hover:bg-amber-100 ${className}`}
      aria-label={`目前排序：${sortLabel}，點擊切換`}
      onClick={toggleSortDirection}
    >
      <ArrowDownUp className="size-4" />排序：{sortLabel}
    </Button>
  );

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="history-heading">
      <div className="flex flex-col gap-4 border-b border-stone-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="lg:min-w-[22rem] lg:text-left">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 lg:grid-cols-[max-content_max-content_max-content] lg:justify-start lg:gap-x-0">
            <p className="eyebrow col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-1">DRAW ARCHIVE</p>
            <span aria-hidden="true" className="eyebrow invisible hidden lg:col-start-2 lg:row-start-1 lg:block">DRAW ARCHIVE</span>
            <h2 id="history-heading" className="col-start-1 row-start-2 mt-1 flex items-center justify-start gap-2 text-left text-xl font-black text-stone-900 lg:col-span-3 lg:col-start-1 lg:row-start-2">
              <History className="size-5 text-red-600" />歷史開獎查詢
            </h2>
            <p
              data-history-lottery-title
              className="col-start-2 row-start-2 mt-1 shrink-0 text-right text-[22px] font-black tracking-[0.08em] lg:col-start-3 lg:row-start-1 lg:mt-0 lg:text-3xl"
              style={{
                color: lotteryConfig.accent,
                textShadow: "0 2px 0 rgba(120,53,15,0.20), 0 4px 10px rgba(120,53,15,0.20)",
                ...(lotteryType === "lotto649" ? {
                  WebkitTextStroke: "1px #1c1917",
                  paintOrder: "stroke fill",
                } : {}),
              }}
            >
              {lotteryConfig.name}
            </p>
          </div>
          {sortButton("mt-3 hidden lg:inline-flex")}
        </div>
        <form
          className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-center"
          onSubmit={event => {
            event.preventDefault();
            setSubmitted({ fromDate, toDate });
          }}
        >
          <div className="grid grid-cols-2 gap-2 lg:contents">
            <Input aria-label="起始日期" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
            <span className="hidden text-xs font-semibold text-stone-400 lg:block">至</span>
            <Input aria-label="結束日期" type="date" value={toDate} onChange={event => setToDate(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:contents">
            {sortButton("w-full lg:hidden")}
            <Button type="submit" size="sm" className="w-full lg:w-auto"><Search className="size-4" />查詢</Button>
          </div>
        </form>
      </div>

      {!session?.user ? (
        <div className="grid min-h-64 place-items-center p-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><LockKeyhole className="size-6" /></span>
            <h3 className="mt-4 text-lg font-black text-stone-900">登入後查詢歷史資料</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">註冊付費會員才可完整查詢，一般會員可查詢近10筆資料</p>
            <Button className="mt-4" onClick={onOpenMember}>登入或免費註冊</Button>
          </div>
        </div>
      ) : historyQuery.isLoading ? (
        <div className="grid min-h-56 place-items-center text-sm font-semibold text-stone-400">正在讀取開獎資料…</div>
      ) : historyQuery.isError ? (
        <div className="p-8 text-center text-sm font-semibold text-red-600">{historyQuery.error.message}</div>
      ) : historyRecords.length ? (
        <>
          {isRegular ? (
            <div className="flex items-center gap-2 bg-amber-50 px-5 py-2.5 text-xs font-semibold text-amber-800">
              <Crown className="size-4" />一般會員每次最多顯示 10 筆；升級付費會員可查詢完整區間。
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-stone-50 text-xs font-bold text-stone-500">
                <tr><th className="px-5 py-3">期數</th><th className="px-5 py-3">開獎日期</th><th className="px-5 py-3">開獎號碼</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {historyRecords.map(record => (
                  <tr key={record.id} className="transition-colors hover:bg-amber-50/30">
                    <td className="px-5 py-4 font-mono text-xs font-black text-stone-700">{record.issue}</td>
                    <td className="px-5 py-4 text-xs font-semibold text-stone-500">民國 {record.drawDateRoc}</td>
                    <td className="px-5 py-4"><LotteryBalls compact lotteryType={record.lotteryType} numbers={record.numbers} specialNumber={record.specialNumber} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid min-h-56 place-items-center p-8 text-center text-sm font-semibold text-stone-400">
          <span><CalendarRange className="mx-auto mb-3 size-7" />此日期區間尚無開獎資料</span>
        </div>
      )}
    </section>
  );
}
