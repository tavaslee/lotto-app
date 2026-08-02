import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAnalysisDefaultRange } from "@/lib/dateRangeDefaults";
import { trpc } from "@/lib/trpc";
import type { MemberSession } from "@/types/member";
import {
  ANALYSIS_PERMISSION_KEYS,
  LOTTERY_CONFIG,
  PERMISSION_LABELS,
  type LotteryType,
  type PermissionKey,
} from "@shared/lottery";
import { BarChart3, CalendarRange, DatabaseZap, Search } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  buildCurrentOmissionRanking,
  buildDistributionStats,
  buildHeadTailRows,
  buildOddEvenRows,
  buildOmissionRows,
  getMaxBall,
  rankNumbersByCount,
  type AnalysisRecord,
} from "./analysisCalculations";

type AnalysisTool = (typeof ANALYSIS_PERMISSION_KEYS)[number];
type RangeCriteria =
  | { rangeMode: "date"; fromDate: string; toDate: string }
  | { rangeMode: "issue"; fromIssue: string; toIssue: string }
  | { rangeMode: "count"; count: number };

const pad = (value: number) => String(value).padStart(2, "0");

const RANKING_BALL_PALETTE: Record<LotteryType, { background: string; foreground: string; border: string }> = {
  lotto649: { background: "#fef9c3", foreground: "#713f12", border: "#fde68a" },
  superLotto638: { background: "#dcfce7", foreground: "#14532d", border: "#bbf7d0" },
  daily539: { background: "#ffedd5", foreground: "#7c2d12", border: "#fed7aa" },
  markSix: { background: "#fee2e2", foreground: "#7f1d1d", border: "#fecaca" },
  fantasy5: { background: "#dbeafe", foreground: "#1e3a8a", border: "#bfdbfe" },
};

function dateCellClass() {
  return "min-w-28 border border-stone-200 bg-white px-2 py-2 text-left text-xs font-bold text-stone-700";
}

function ballStyle(lotteryType: LotteryType, special = false): React.CSSProperties {
  return {
    backgroundColor: special ? "#171717" : LOTTERY_CONFIG[lotteryType].accent,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,.45)",
  };
}

function RankingBall({ lotteryType, number }: { lotteryType: LotteryType; number: number }) {
  const palette = RANKING_BALL_PALETTE[lotteryType];
  return (
    <span
      className="mx-auto grid size-7 place-items-center rounded-full font-mono text-[11px] font-black"
      data-ranking-ball={lotteryType}
      style={{
        backgroundColor: palette.background,
        color: palette.foreground,
        boxShadow: `inset 0 0 0 1px ${palette.border}, 0 1px 2px rgba(28, 25, 23, 0.12)`,
      }}
    >
      {pad(number)}
    </span>
  );
}

function MatrixHeader({ maxBall }: { maxBall: number }) {
  return (
    <tr>
      <th className={dateCellClass()}>開獎日期</th>
      {Array.from({ length: maxBall }, (_, index) => (
        <th key={index} className="min-w-9 border border-stone-200 bg-stone-50 px-1 py-2 font-mono text-[11px] font-black text-stone-600">
          {pad(index + 1)}
        </th>
      ))}
    </tr>
  );
}

function DistributionTable({
  records,
  lotteryType,
  includeSpecial,
}: {
  records: AnalysisRecord[];
  lotteryType: LotteryType;
  includeSpecial: boolean;
}) {
  const maxBall = getMaxBall(lotteryType);
  const numbers = Array.from({ length: maxBall }, (_, index) => index + 1);
  const { frequency, sortedNumbers } = buildDistributionStats(records, maxBall, includeSpecial);
  const maxFrequency = Math.max(1, ...frequency);

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-stone-200 bg-white">
      <table className="min-w-max border-collapse text-center">
        <thead><MatrixHeader maxBall={maxBall} /></thead>
        <tbody>
          {records.map(record => {
            const hits = new Set(record.numbers.map(Number));
            const special = includeSpecial && record.specialNumber ? Number(record.specialNumber) : null;
            return (
              <tr key={record.id}>
                <th className={dateCellClass()}>{record.drawDateRoc}<span className="ml-1 text-[10px] text-stone-400">{record.issue}</span></th>
                {numbers.map(number => {
                  const isSpecial = special === number;
                  const hit = hits.has(number) || isSpecial;
                  return (
                    <td key={number} className="h-9 border border-stone-200 p-0.5">
                      {hit ? <span className="grid h-8 min-w-8 place-items-center rounded-md font-mono text-xs font-black" style={ballStyle(lotteryType, isSpecial)}>{pad(number)}</span> : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th className={dateCellClass()}>號碼</th>
            {numbers.map(number => <td key={number} className="border border-stone-200 bg-stone-50 py-1.5"><RankingBall lotteryType={lotteryType} number={number} /></td>)}
          </tr>
          <tr>
            <th className={dateCellClass()}>次數統計</th>
            {frequency.map((count, index) => (
              <td key={index} className="border border-stone-200 bg-amber-50/40 p-1">
                <span className="block text-[11px] font-black text-stone-800">{count}</span>
                <span className="mx-auto mt-1 block h-1.5 rounded-full bg-red-500" style={{ width: `${Math.max(8, (count / maxFrequency) * 100)}%` }} />
              </td>
            ))}
          </tr>
          <tr aria-hidden="true">
            <td colSpan={maxBall + 1} className="h-4 border-0 bg-stone-100/70" />
          </tr>
          <tr>
            <th className={dateCellClass()}>號碼排名</th>
            {sortedNumbers.map(number => <td key={number} className="border border-stone-200 bg-red-50 py-1.5"><RankingBall lotteryType={lotteryType} number={number} /></td>)}
          </tr>
          <tr>
            <th className={dateCellClass()}>出現次數</th>
            {sortedNumbers.map(number => <td key={number} className="border border-stone-200 bg-amber-50/40 py-2 text-xs font-black text-stone-800">{frequency[number - 1]}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OddEvenTable({
  records,
  lotteryType,
  includeSpecial,
}: {
  records: AnalysisRecord[];
  lotteryType: LotteryType;
  includeSpecial: boolean;
}) {
  const config = LOTTERY_CONFIG[lotteryType];
  const rows = buildOddEvenRows(records, includeSpecial);
  const hasSpecialColumn = Boolean(config.specialNumberRange);
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full min-w-[760px] border-collapse text-center text-sm">
        <thead><tr className="bg-stone-50">
          <th className="border border-stone-200 px-3 py-3 text-left">開獎日期</th>
          <th className="border border-stone-200 px-3 py-3">期數</th>
          {Array.from({ length: config.ballCount }, (_, index) => <th key={index} className="border border-stone-200 px-2 py-3">號碼{index + 1}</th>)}
          {hasSpecialColumn ? <th className="border border-stone-200 px-2 py-3">特別號</th> : null}
          <th className="border border-stone-200 px-3 py-3">單雙比</th><th className="border border-stone-200 px-3 py-3">和值</th>
        </tr></thead>
        <tbody>{rows.map((row, rowIndex) => {
          const record = records[rowIndex];
          return <tr key={row.id}>
            <td className="border border-stone-200 px-3 py-3 text-left font-bold">{row.drawDateRoc}</td>
            <td className="border border-stone-200 px-3 py-3 font-mono text-xs">{row.issue}</td>
            {record.numbers.map(number => <td key={number} className="border border-stone-200 p-1.5"><span className="mx-auto grid size-8 place-items-center rounded-full font-mono text-xs font-black" style={ballStyle(lotteryType)}>{number}</span></td>)}
            {hasSpecialColumn ? <td className="border border-stone-200 p-1.5">{includeSpecial && record.specialNumber ? <span className="mx-auto grid size-8 place-items-center rounded-full font-mono text-xs font-black" style={ballStyle(lotteryType, true)}>{record.specialNumber}</span> : null}</td> : null}
            <td className="border border-stone-200 px-3 py-3 font-black text-red-700">{row.odd}:{row.even}</td>
            <td className="border border-stone-200 px-3 py-3 font-black text-stone-900">{row.sum}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function HeadTailTable({
  records,
  lotteryType,
  includeSpecial,
}: {
  records: AnalysisRecord[];
  lotteryType: LotteryType;
  includeSpecial: boolean;
}) {
  const maxBall = getMaxBall(lotteryType);
  const rows = buildHeadTailRows(records, maxBall, includeSpecial);
  const headCount = Math.floor(maxBall / 10) + 1;
  const headTotals = Array.from({ length: headCount }, (_, index) =>
    rows.reduce((total, row) => total + (row.heads[index] ?? 0), 0),
  );
  const tailTotals = Array.from({ length: 10 }, (_, index) =>
    rows.reduce((total, row) => total + (row.tails[index] ?? 0), 0),
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full min-w-[1080px] border-collapse text-center text-sm">
        <thead><tr className="bg-stone-50">
          <th className="border border-stone-200 px-3 py-3 text-left">開獎日期</th><th className="border border-stone-200 px-3 py-3">期數</th>
          <th className="min-w-56 border border-stone-200 px-3 py-3">開獎號碼</th>
          {Array.from({ length: headCount }, (_, index) => <th key={`h${index}`} className="border border-stone-200 px-2 py-3">{index}頭</th>)}
          {Array.from({ length: 10 }, (_, index) => <th key={`t${index}`} className="border border-stone-200 px-2 py-3">{index}尾</th>)}
        </tr></thead>
        <tbody>{rows.map((row, rowIndex) => {
          const record = records[rowIndex];
          return <tr key={row.id}>
          <td className="border border-stone-200 px-3 py-3 text-left font-bold">{row.drawDateRoc}</td><td className="border border-stone-200 px-3 py-3 font-mono text-xs">{row.issue}</td>
          <td className="border border-stone-200 px-3 py-2">
            <div className="flex min-w-max items-center justify-center gap-1.5">
              {record.numbers.map((number, index) => <span key={`${number}-${index}`} className="grid size-8 place-items-center rounded-full font-mono text-xs font-black" style={ballStyle(lotteryType)}>{number}</span>)}
              {includeSpecial && record.specialNumber ? <span className="grid size-8 place-items-center rounded-full font-mono text-xs font-black" style={ballStyle(lotteryType, true)}>{record.specialNumber}</span> : null}
            </div>
          </td>
          {row.heads.map((count, index) => <td key={`h${index}`} className="border border-stone-200 bg-amber-50/40 py-3 font-black">{count}</td>)}
          {row.tails.map((count, index) => <td key={`t${index}`} className="border border-stone-200 py-3 font-black text-stone-700">{count}</td>)}
        </tr>;
        })}</tbody>
        <tfoot>
          <tr>
            <th colSpan={3} className="border border-stone-200 bg-red-50 px-3 py-3 text-left font-black text-red-800">總出現次數</th>
            {headTotals.map((count, index) => <td key={`head-total-${index}`} className="border border-stone-200 bg-amber-100/70 py-3 font-black text-stone-900">{count}</td>)}
            {tailTotals.map((count, index) => <td key={`tail-total-${index}`} className="border border-stone-200 bg-stone-100 py-3 font-black text-stone-800">{count}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OmissionTable({
  records,
  lotteryType,
  includeSpecial,
  omissionBeforeSelection,
  maxOmission,
}: {
  records: AnalysisRecord[];
  lotteryType: LotteryType;
  includeSpecial: boolean;
  omissionBeforeSelection: number[];
  maxOmission: number[];
}) {
  const maxBall = getMaxBall(lotteryType);
  const rows = buildOmissionRows(records, maxBall, includeSpecial, omissionBeforeSelection);
  const currentRanking = buildCurrentOmissionRanking(rows, maxBall);
  const historicalRanking = rankNumbersByCount(maxOmission, maxBall);
  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-stone-200 bg-white">
      <table className="min-w-max border-collapse text-center">
        <thead><MatrixHeader maxBall={maxBall} /></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <th className={dateCellClass()}>{row.drawDateRoc}<span className="ml-1 text-[10px] text-stone-400">{row.issue}</span></th>
          {row.cells.map((cell, index) => <td key={index} className={`h-9 min-w-9 border border-stone-200 p-0 text-xs font-bold ${cell.hit ? "bg-sky-200 text-stone-950" : cell.trailing ? "bg-yellow-200 text-stone-500" : "bg-white text-stone-400"}`}>{cell.hit ? pad(cell.value) : cell.value}</td>)}
        </tr>)}</tbody>
        <tfoot>
          <tr>
            <th className={dateCellClass()}>本次號碼排名</th>
            {currentRanking.map(({ number }) => <td key={number} className="border border-stone-200 bg-amber-50/60 py-1.5"><RankingBall lotteryType={lotteryType} number={number} /></td>)}
          </tr>
          <tr>
            <th className={dateCellClass()}>本次統計次數</th>
            {currentRanking.map(({ number, count }) => <td key={number} className="border border-stone-200 bg-amber-50/40 py-2 text-xs font-black text-stone-800">{count}</td>)}
          </tr>
          <tr aria-hidden="true">
            <td colSpan={maxBall + 1} className="h-4 border-0 bg-stone-100/70" />
          </tr>
          <tr>
            <th className={dateCellClass()}>號碼排名</th>
            {historicalRanking.map(({ number }) => <td key={number} className="border border-stone-200 bg-red-50 py-1.5"><RankingBall lotteryType={lotteryType} number={number} /></td>)}
          </tr>
          <tr>
            <th className={dateCellClass()}>最大未開次數</th>
            {historicalRanking.map(({ number, count }) => <td key={number} className="border border-stone-200 bg-red-50 py-2 text-xs font-black text-red-700">{count}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AnalysisPanel({
  lotteryType,
  tool,
  session,
}: {
  lotteryType: LotteryType;
  tool: PermissionKey;
  session: MemberSession | undefined;
}) {
  const analysisTool = tool as AnalysisTool;
  const [rangeMode, setRangeMode] = useState<"date" | "issue" | "count">("date");
  const defaultRange = useMemo(
    () => getAnalysisDefaultRange(session?.user),
    [session?.user?.id, session?.user?.memberLevel, session?.user?.role],
  );
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [fromIssue, setFromIssue] = useState("");
  const [toIssue, setToIssue] = useState("");
  const [periodCount, setPeriodCount] = useState("30");
  const [includeSpecial, setIncludeSpecial] = useState(false);
  const [criteria, setCriteria] = useState<RangeCriteria>(() => ({ rangeMode: "date", ...defaultRange }));
  const [validationError, setValidationError] = useState("");
  const supportsSpecial = lotteryType === "lotto649" || lotteryType === "markSix";
  const actualIncludeSpecial = supportsSpecial && includeSpecial;

  useEffect(() => {
    setIncludeSpecial(false);
    setFromDate(defaultRange.fromDate);
    setToDate(defaultRange.toDate);
    setCriteria({ rangeMode: "date", ...defaultRange });
    setRangeMode("date");
  }, [defaultRange.fromDate, defaultRange.toDate, lotteryType]);

  const request = useMemo(() => criteria.rangeMode === "date"
    ? { lotteryType, tool: analysisTool, includeSpecial: actualIncludeSpecial, rangeMode: "date" as const, fromDate: criteria.fromDate, toDate: criteria.toDate }
    : criteria.rangeMode === "issue"
      ? { lotteryType, tool: analysisTool, includeSpecial: actualIncludeSpecial, rangeMode: "issue" as const, fromIssue: criteria.fromIssue, toIssue: criteria.toIssue }
      : { lotteryType, tool: analysisTool, includeSpecial: actualIncludeSpecial, rangeMode: "count" as const, count: criteria.count },
  [actualIncludeSpecial, analysisTool, criteria, lotteryType]);
  const query = trpc.lottery.analysis.useQuery(request);
  const result = query.data;
  const records = result?.records ?? [];

  const search = () => {
    setValidationError("");
    if (rangeMode === "date") {
      if (!fromDate || !toDate) return setValidationError("請完整選擇起訖日期");
      setCriteria({ rangeMode: "date", fromDate, toDate });
    } else if (rangeMode === "issue") {
      if (!fromIssue.trim() || !toIssue.trim()) return setValidationError("請完整輸入起訖期數");
      setCriteria({ rangeMode: "issue", fromIssue: fromIssue.trim(), toIssue: toIssue.trim() });
    } else {
      const count = Number(periodCount);
      if (!Number.isInteger(count) || count < 1) return setValidationError("查詢期數請輸入大於 0 的整數");
      setCriteria({ rangeMode: "count", count });
    }
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-stone-100 p-5 sm:p-6">
        <p className="eyebrow">TREND ANALYSIS</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><BarChart3 className="size-6 text-red-600" />{PERMISSION_LABELS[analysisTool]}</h1>
        <p className="mt-1 text-sm text-stone-500">選擇日期、期數區間或最近期數分析 {LOTTERY_CONFIG[lotteryType].name}；結果由舊到新排列。</p>
      </div>

      <div className="border-b border-stone-100 bg-stone-50/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRangeMode("date")} className={`rounded-xl px-4 py-2 text-sm font-black ${rangeMode === "date" ? "bg-stone-900 text-white" : "bg-white text-stone-500"}`}>日期區間</button>
          <button type="button" onClick={() => setRangeMode("issue")} className={`rounded-xl px-4 py-2 text-sm font-black ${rangeMode === "issue" ? "bg-stone-900 text-white" : "bg-white text-stone-500"}`}>期數區間</button>
          <button type="button" onClick={() => setRangeMode("count")} className={`rounded-xl px-4 py-2 text-sm font-black ${rangeMode === "count" ? "bg-stone-900 text-white" : "bg-white text-stone-500"}`}>查幾期</button>
          {query.data ? <span className="ml-auto rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{query.data.roleLimit === null ? "管理員不限期數" : `本帳號最多 ${query.data.roleLimit} 期`}</span> : null}
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          {rangeMode === "date" ? <>
            <label className="grid flex-1 gap-1.5 text-xs font-bold text-stone-600">起始日期<Input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
            <label className="grid flex-1 gap-1.5 text-xs font-bold text-stone-600">結束日期<Input type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
          </> : rangeMode === "issue" ? <>
            <label className="grid flex-1 gap-1.5 text-xs font-bold text-stone-600">起始期數<Input value={fromIssue} onChange={event => setFromIssue(event.target.value)} placeholder="例如：115000001" /></label>
            <label className="grid flex-1 gap-1.5 text-xs font-bold text-stone-600">結束期數<Input value={toIssue} onChange={event => setToIssue(event.target.value)} placeholder="例如：115000030" /></label>
          </> : <>
            <label className="grid flex-1 gap-1.5 text-xs font-bold text-stone-600">查詢期數<Input type="number" min={1} step={1} inputMode="numeric" value={periodCount} onChange={event => setPeriodCount(event.target.value)} placeholder="例如：30" /></label>
          </>}
          {supportsSpecial ? <label className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700"><input type="checkbox" checked={includeSpecial} onChange={event => setIncludeSpecial(event.target.checked)} className="size-4 accent-red-600" />包含特別號</label> : null}
          {lotteryType === "superLotto638" ? <span className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">第二區不納入分析</span> : null}
          <Button type="button" onClick={search} className="min-h-10 bg-red-700 text-white hover:bg-red-800"><Search className="size-4" />查詢分析</Button>
        </div>
        {validationError ? <p className="mt-2 text-xs font-bold text-red-600">{validationError}</p> : null}
      </div>

      {query.isLoading ? <div className="grid min-h-72 place-items-center text-sm font-semibold text-stone-400"><span><CalendarRange className="mx-auto mb-3 size-8 animate-pulse" />正在分析 Google Sheets 資料…</span></div> : query.error ? (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{query.error.message}</div>
      ) : !result || !records.length ? (
        <div className="grid min-h-72 place-items-center p-8 text-center text-sm font-semibold text-stone-400"><span><DatabaseZap className="mx-auto mb-3 size-8" />選定區間沒有可供分析的開獎資料</span></div>
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-stone-500">
            <span>實際分析 {records.length} 期，共符合 {result.totalMatched} 期</span>
            {result.truncated ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">已依會員等級顯示最近 {result.roleLimit} 期</span> : null}
          </div>
          {analysisTool === "distributionChart" ? <DistributionTable records={records} lotteryType={lotteryType} includeSpecial={result.includeSpecial} /> : null}
          {analysisTool === "oddEvenRatio" ? <OddEvenTable records={records} lotteryType={lotteryType} includeSpecial={result.includeSpecial} /> : null}
          {analysisTool === "headNumbers" ? <HeadTailTable records={records} lotteryType={lotteryType} includeSpecial={result.includeSpecial} /> : null}
          {analysisTool === "missingNumbers" ? <OmissionTable records={records} lotteryType={lotteryType} includeSpecial={result.includeSpecial} omissionBeforeSelection={result.omissionBeforeSelection} maxOmission={result.maxOmission} /> : null}
        </div>
      )}
    </section>
  );
}
