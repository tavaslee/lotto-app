import React from "react";
import { LotteryBalls } from "./LotteryBalls";
import { Skeleton } from "@/components/ui/skeleton";
import { LOTTERY_CONFIG, LOTTERY_TYPES, type LotteryType } from "@shared/lottery";
import type { RouterOutputs } from "@/types/member";
import { CalendarDays, DatabaseZap } from "lucide-react";

type LatestAll = RouterOutputs["lottery"]["latestAll"];

export function LatestBoard({ data, loading, error = false, visibleLotteryTypes = LOTTERY_TYPES }: { data?: LatestAll; loading: boolean; error?: boolean; visibleLotteryTypes?: readonly LotteryType[] }) {
  return (
    <section aria-labelledby="latest-heading">
      <div className="mb-4">
        <div>
          <p className="eyebrow">LATEST DRAW</p>
          <h1 id="latest-heading" className="mt-1 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
            最新開獎號碼
          </h1>
        </div>
      </div>

      {error ? (
        <div role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          開獎資料讀取額度暫時繁忙，系統將稍後自動重試；請稍後再查看最新資料。
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleLotteryTypes.map((lotteryType, index) => {
          const record = data?.[lotteryType];
          const config = LOTTERY_CONFIG[lotteryType];
          if (loading) {
            return <Skeleton key={lotteryType} className={`h-44 rounded-2xl ${index === 0 ? "xl:col-span-2" : ""}`} />;
          }
          return (
            <article
              key={lotteryType}
              className={`surface-card relative overflow-hidden p-5 sm:p-6 ${index === 0 ? "xl:col-span-2" : ""}`}
            >
              <span
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: config.accent }}
                aria-hidden="true"
              />
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-stone-900">{config.name}</span>
                    {record ? (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 font-mono text-[11px] font-bold text-stone-500">
                        第 {record.issue} 期
                      </span>
                    ) : null}
                    {record ? (
                      <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-stone-400 sm:hidden">
                        <CalendarDays className="size-3.5" />民國 {record.drawDateRoc}
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-1 items-center gap-1.5 text-xs font-medium text-stone-400 ${record ? "hidden sm:flex" : "flex"}`}>
                    <CalendarDays className="size-3.5" />
                    {record ? `民國 ${record.drawDateRoc}` : "尚無開獎資料"}
                  </p>
                </div>
                {record ? (
                  <LotteryBalls latest lotteryType={lotteryType} numbers={record.numbers} specialNumber={record.specialNumber} />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-400">
                    <DatabaseZap className="size-4" />等待後台更新
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
