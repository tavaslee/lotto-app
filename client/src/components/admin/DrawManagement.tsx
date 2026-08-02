import { LotteryBalls } from "@/components/site/LotteryBalls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  LOTTERY_CONFIG,
  LOTTERY_TYPE_BY_NAME,
  LOTTERY_TYPES,
  type LotteryType,
} from "@shared/lottery";
import { FileSpreadsheet, Pencil, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getDefaultDrawDateRoc, getNextIssueFromLatest } from "./drawDefaults";

type ImportRecord = {
  lotteryType: LotteryType;
  issue: string;
  drawDateRoc: string;
  numbers: string[];
  specialNumber: string | null;
  status: "active" | "inactive" | "draft";
};

const pad = (value: string | number) => String(value).trim().padStart(2, "0");

export function parseRapidInput(lotteryType: LotteryType, value: string) {
  const count = LOTTERY_CONFIG[lotteryType].ballCount;
  const trimmed = value.trim();
  const values = /[\s,，、-]/.test(trimmed)
    ? trimmed.split(/[\s,，、-]+/).filter(Boolean)
    : trimmed.replace(/\D/g, "").match(/\d{2}/g) ?? [];
  if (values.length !== count) throw new Error(`${LOTTERY_CONFIG[lotteryType].name} 必須輸入 ${count} 個兩位數號碼`);
  const normalized = values.map((raw, index) => {
    const number = Number(raw);
    const range = LOTTERY_CONFIG[lotteryType].numberRanges[index];
    if (!Number.isInteger(number) || number < range.min || number > range.max) {
      throw new Error(`第 ${index + 1} 個號碼須介於 ${range.min}～${range.max}`);
    }
    return pad(number);
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("基本號碼不可重複");
  }
  return normalized;
}

export function normalizeRocDate(value: unknown) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) throw new Error("無法解析 Excel 日期");
    return `${String(parsed.y - 1911).padStart(3, "0")}.${String(parsed.m).padStart(2, "0")}.${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim().replace(/[/-]/g, ".");
  const match = text.match(/^(\d{2,4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) throw new Error(`日期「${text}」格式錯誤`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const gregorianYear = year > 1911 ? year : year + 1911;
  const date = new Date(Date.UTC(gregorianYear, month - 1, day));
  if (
    date.getUTCFullYear() !== gregorianYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`日期「${text}」不是有效日期`);
  }
  return `${String(year > 1911 ? year - 1911 : year).padStart(3, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

export function DrawManagement() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lotteryType, setLotteryType] = useState<LotteryType>("lotto649");
  const [issue, setIssue] = useState("");
  const [drawDateRoc, setDrawDateRoc] = useState(() => getDefaultDrawDateRoc("lotto649"));
  const [formMode, setFormMode] = useState<"new" | "edit">("new");
  const [rapidInput, setRapidInput] = useState("");
  const [specialNumber, setSpecialNumber] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "draft">("active");
  const [searchIssue, setSearchIssue] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchParams, setSearchParams] = useState<{ lotteryType: LotteryType; issue?: string; date?: string } | null>(null);
  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const parsedNumbers = useMemo(() => {
    try { return parseRapidInput(lotteryType, rapidInput); } catch { return []; }
  }, [lotteryType, rapidInput]);

  const searchQuery = trpc.lottery.adminSearch.useQuery(searchParams ?? { lotteryType }, {
    enabled: Boolean(searchParams),
  });
  const latestQuery = trpc.lottery.latest.useQuery({ lotteryType }, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (formMode !== "new") return;
    setIssue(current => current || getNextIssueFromLatest(latestQuery.data));
    setDrawDateRoc(current => current || getDefaultDrawDateRoc(lotteryType));
  }, [formMode, latestQuery.data?.issue, lotteryType]);

  const saveMutation = trpc.lottery.save.useMutation({
    onSuccess: async saved => {
      toast.success("開獎資料已寫入 Google Sheets");
      setFormMode("new");
      setIssue("");
      setDrawDateRoc(getDefaultDrawDateRoc(saved.lotteryType));
      setRapidInput(""); setSpecialNumber("");
      await utils.lottery.latest.invalidate({ lotteryType: saved.lotteryType });
      const refreshedLatest = await latestQuery.refetch();
      if (refreshedLatest.error || !refreshedLatest.data) {
        setIssue("");
        toast.error("無法取得最新一期", { description: "期數未自動回填，請重新讀取後再新增，避免使用錯誤期數。" });
      } else {
        setIssue(getNextIssueFromLatest(refreshedLatest.data));
      }
      if (searchParams) await searchQuery.refetch();
    },
    onError: error => toast.error("儲存失敗", { description: error.message }),
  });
  const deleteMutation = trpc.lottery.delete.useMutation({
    onSuccess: async () => { toast.success("指定期數已刪除"); await searchQuery.refetch(); },
    onError: error => toast.error("刪除失敗", { description: error.message }),
  });
  const batchMutation = trpc.lottery.batchSave.useMutation({
    onSuccess: result => { toast.success(`已匯入 ${result.imported} 筆開獎資料`); setImportRecords([]); setImportErrors([]); },
    onError: error => toast.error("批次匯入失敗", { description: error.message }),
  });

  const submitDraw = (event: FormEvent) => {
    event.preventDefault();
    try {
      const numbers = parseRapidInput(lotteryType, rapidInput);
      saveMutation.mutate({
        lotteryType,
        issue,
        drawDateRoc,
        numbers,
        specialNumber: LOTTERY_CONFIG[lotteryType].specialNumberRange ? specialNumber || null : null,
        status,
      });
    } catch (error) {
      toast.error("號碼格式不正確", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const loadRecord = (record: NonNullable<typeof searchQuery.data>["target"]) => {
    if (!record) return;
    setFormMode("edit");
    setLotteryType(record.lotteryType);
    setIssue(record.issue);
    setDrawDateRoc(record.drawDateRoc);
    setRapidInput(record.numbers.join(""));
    setSpecialNumber(record.specialNumber ?? "");
    setStatus(record.status);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const importExcel = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error("Excel 檔案沒有可讀取的工作表");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: "",
      raw: true,
    });
    const records: ImportRecord[] = [];
    const errors: string[] = [];
    rows.forEach((row, index) => {
      try {
        const typeText = String(row["彩別"] ?? "").trim();
        const type = LOTTERY_TYPE_BY_NAME[typeText] ?? (LOTTERY_TYPES.includes(typeText as LotteryType) ? typeText as LotteryType : undefined);
        if (!type) throw new Error(`未知彩別「${typeText}」`);
        const numberValues = Array.from({ length: LOTTERY_CONFIG[type].ballCount }, (_, numberIndex) => row[`號碼${numberIndex + 1}`]);
        records.push({
          lotteryType: type,
          issue: String(row["期數"] ?? "").trim(),
          drawDateRoc: normalizeRocDate(row["開獎日期（民國）"] || row["開獎日期"]),
          numbers: numberValues.map(value => pad(String(value ?? ""))),
          specialNumber: row["特別號"] === "" ? null : pad(String(row["特別號"] ?? "")),
          status: String(row["資料狀態"] ?? "啟用") === "停用" ? "inactive" : String(row["資料狀態"] ?? "") === "草稿" ? "draft" : "active",
        });
      } catch (error) {
        errors.push(`第 ${index + 2} 列：${error instanceof Error ? error.message : String(error)}`);
      }
    });
    setImportRecords(records);
    setImportErrors(errors);
    if (!records.length) toast.error("檔案中沒有可匯入的資料");
  };

  const searchResult = searchQuery.data;
  return (
    <div className="space-y-6">
      <div><p className="eyebrow">DRAW DATA</p><h2 className="mt-1 text-2xl font-black text-stone-950">開獎號碼維護</h2><p className="mt-2 text-sm text-stone-500">兩位數連續輸入、Excel 批次匯入與 Google Sheets 即時 CRUD。</p></div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <form onSubmit={submitDraw} className="surface-card space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h3 className="font-black text-stone-900">單筆新增／修改</h3><p className="mt-1 text-xs text-stone-400">輸入連續兩位數，例如 01081223354149</p></div><Sparkles className="size-5 text-orange-500" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>彩別</Label><select value={lotteryType} onChange={event => { const type = event.target.value as LotteryType; setLotteryType(type); setFormMode("new"); setIssue(""); setDrawDateRoc(getDefaultDrawDateRoc(type)); setRapidInput(""); setSpecialNumber(""); }} className="h-9 w-full rounded-md border bg-white px-3 text-sm font-semibold">{LOTTERY_TYPES.map(type => <option key={type} value={type}>{LOTTERY_CONFIG[type].name}</option>)}</select></div>
            <div className="space-y-1.5"><Label>期數</Label><Input required value={issue} onChange={event => setIssue(event.target.value)} placeholder="115000042" /></div>
            <div className="space-y-1.5"><Label>開獎日期（民國）</Label><Input required value={drawDateRoc} onChange={event => setDrawDateRoc(event.target.value)} placeholder="115.07.08" /></div>
          </div>
          {formMode === "new" && latestQuery.isError ? (
            <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <span>最新一期讀取失敗，系統不會填入不可靠的期數；請重新讀取或自行確認後輸入。</span>
              <Button type="button" size="sm" variant="outline" className="shrink-0 bg-white" onClick={() => void latestQuery.refetch()} disabled={latestQuery.isFetching}>重新讀取</Button>
            </div>
          ) : formMode === "new" && latestQuery.isSuccess && !latestQuery.data ? (
            <p className="rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">此彩別尚無上一期資料，請手動輸入第一期期數。</p>
          ) : null}
          <div className="space-y-1.5"><Label>極速連續輸入</Label><Input value={rapidInput} onChange={event => setRapidInput(event.target.value)} inputMode="numeric" placeholder={LOTTERY_CONFIG[lotteryType].ballCount === 6 ? "010812233541" : "0108122335"} className="h-12 font-mono text-lg font-black tracking-[.15em]" /></div>
          <div className="min-h-14 rounded-xl bg-stone-50 p-3">{parsedNumbers.length ? <LotteryBalls numbers={parsedNumbers} specialNumber={LOTTERY_CONFIG[lotteryType].specialNumberRange && specialNumber ? pad(specialNumber) : null} lotteryType={lotteryType} /> : <p className="py-2 text-xs font-semibold text-stone-400">完成輸入後會在此預覽彩球並檢查各區號碼範圍。</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2">{LOTTERY_CONFIG[lotteryType].specialNumberRange ? <div className="space-y-1.5"><Label>特別號（必填）</Label><Input value={specialNumber} onChange={event => setSpecialNumber(event.target.value)} inputMode="numeric" required placeholder="08" /></div> : <div className="grid place-items-center rounded-xl bg-stone-50 px-3 text-xs font-semibold text-stone-400">此彩別無特別號</div>}<div className="space-y-1.5"><Label>資料狀態</Label><select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-9 w-full rounded-md border bg-white px-3 text-sm"><option value="active">啟用</option><option value="draft">草稿</option><option value="inactive">停用</option></select></div></div>
          <Button type="submit" className="w-full sm:w-auto" disabled={saveMutation.isPending}>{saveMutation.isPending ? "寫入中…" : "儲存至 Google Sheets"}</Button>
        </form>

        <section className="surface-card space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h3 className="font-black text-stone-900">Excel 批次匯入</h3><p className="mt-1 text-xs text-stone-400">支援 5／6 個一般號碼，特別號使用獨立欄位</p></div><FileSpreadsheet className="size-5 text-emerald-600" /></div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importExcel(file); event.currentTarget.value = ""; }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="grid min-h-32 w-full place-items-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 text-center hover:border-orange-300 hover:bg-orange-50"><span><Upload className="mx-auto mb-2 size-6 text-orange-500" /><strong className="block text-sm text-stone-700">選擇 Excel／CSV 檔案</strong><small className="mt-1 block text-stone-400">第一列須為欄位名稱</small></span></button>
          {importRecords.length || importErrors.length ? <div className="rounded-xl bg-stone-50 p-3 text-xs"><p className="font-bold text-stone-700">可匯入 {importRecords.length} 筆 · 錯誤 {importErrors.length} 筆</p>{importErrors.length ? <div className="mt-2 max-h-24 overflow-y-auto text-red-600">{importErrors.slice(0, 10).map(error => <p key={error}>{error}</p>)}</div> : null}</div> : null}
          <Button className="w-full" disabled={!importRecords.length || batchMutation.isPending} onClick={() => batchMutation.mutate({ records: importRecords })}>{batchMutation.isPending ? "批次寫入中…" : `確認匯入 ${importRecords.length} 筆`}</Button>
        </section>
      </div>

      <section className="surface-card space-y-5 p-5 sm:p-6">
        <div><h3 className="font-black text-stone-900">指定期數／日期搜尋</h3><p className="mt-1 text-xs text-stone-400">找到目標後同步顯示前後各 10 筆鄰居資料。</p></div>
        <form className="grid gap-3 sm:grid-cols-[180px_1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); if (!searchIssue && !searchDate) return toast.error("請至少輸入期數或日期"); setSearchParams({ lotteryType, issue: searchIssue || undefined, date: searchDate || undefined }); }}>
          <select value={lotteryType} onChange={event => setLotteryType(event.target.value as LotteryType)} className="h-9 rounded-md border bg-white px-3 text-sm font-semibold">{LOTTERY_TYPES.map(type => <option key={type} value={type}>{LOTTERY_CONFIG[type].name}</option>)}</select>
          <Input value={searchIssue} onChange={event => setSearchIssue(event.target.value)} placeholder="期數" />
          <Input value={searchDate} onChange={event => setSearchDate(event.target.value)} placeholder="115.07.08" />
          <Button type="submit" disabled={searchQuery.isFetching}><Search className="size-4" />搜尋</Button>
        </form>
        {searchParams && !searchQuery.isFetching && !searchResult?.target ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">找不到符合條件的開獎資料。</p> : null}
        {searchResult?.target ? <div className="space-y-4"><div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-orange-600">搜尋目標</p><p className="mt-1 font-black text-stone-900">第 {searchResult.target.issue} 期 · {searchResult.target.drawDateRoc}</p></div><LotteryBalls numbers={searchResult.target.numbers} specialNumber={searchResult.target.specialNumber} lotteryType={searchResult.target.lotteryType} compact /><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => loadRecord(searchResult.target)}><Pencil className="size-3.5" />修改</Button><Button size="sm" variant="destructive" onClick={() => { if (confirm(`確定刪除第 ${searchResult.target?.issue} 期？`)) deleteMutation.mutate({ lotteryType: searchResult.target!.lotteryType, issue: searchResult.target!.issue }); }}><Trash2 className="size-3.5" />刪除</Button></div></div></div><div className="grid gap-4 lg:grid-cols-2">{[{ label: "前 10 筆", rows: searchResult.before }, { label: "後 10 筆", rows: searchResult.after }].map(group => <div key={group.label} className="overflow-hidden rounded-xl border"><p className="bg-stone-50 px-4 py-2 text-xs font-bold text-stone-500">{group.label}</p><div className="max-h-72 overflow-y-auto divide-y">{group.rows.length ? group.rows.map(record => <button key={record.id} type="button" onClick={() => loadRecord(record)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-orange-50"><span><strong className="block text-xs text-stone-800">{record.issue}</strong><small className="text-stone-400">{record.drawDateRoc}</small></span><span className="font-mono text-xs font-bold text-stone-600">{record.numbers.join(" ")}</span></button>) : <p className="p-4 text-xs text-stone-400">無相鄰資料</p>}</div></div>)}</div></div> : null}
      </section>
    </div>
  );
}
