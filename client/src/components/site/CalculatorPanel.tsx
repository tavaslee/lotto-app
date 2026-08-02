import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Calculator, Columns3, Info, Sigma } from "lucide-react";
import React, { useMemo, useState } from "react";

const combinations = (n: number, r: number) => {
  if (n < r || r < 0) return 0;
  let result = 1;
  for (let index = 1; index <= r; index += 1) result = (result * (n - r + index)) / index;
  return Math.round(result);
};

export const getValidBallCount = (value: string) => {
  const count = Number(value);
  return Number.isInteger(count) && count >= 2 && count <= 49 ? count : 0;
};

function columnCombinations(columns: number[], size: number) {
  const walk = (start: number, remaining: number): number => {
    if (remaining === 0) return 1;
    let total = 0;
    for (let index = start; index <= columns.length - remaining; index += 1) total += columns[index] * walk(index + 1, remaining - 1);
    return total;
  };
  return walk(0, size);
}

type Results = { two: number; three: number; four: number };

function ResultPanel({ results }: { results: Results }) {
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl bg-stone-950 p-5 text-white shadow-xl shadow-stone-900/10">
      <Sigma className="absolute -right-5 -top-5 size-24 text-white/[0.05]" />
      <p className="text-xs font-bold tracking-[0.18em] text-amber-300">CALCULATION RESULT</p>
      <div className="mt-3 divide-y divide-white/10">
        {[["二星組合", results.two], ["三星組合", results.three], ["四星組合", results.four]].map(([label, result]) => (
          <div key={String(label)} className="flex items-center justify-between py-3"><span className="text-sm text-stone-300">{label}</span><strong className="font-mono text-xl font-black text-amber-300">{Number(result).toLocaleString()} <small className="text-xs text-stone-400">碰</small></strong></div>
        ))}
      </div>
    </div>
  );
}

export function CalculatorPanel({ initialMode = "combination", combined = false }: { initialMode?: "combination" | "column"; combined?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [ballCountText, setBallCountText] = useState("");
  const [columnsText, setColumnsText] = useState("3 2 2");
  const validBallCount = getValidBallCount(ballCountText);
  const columns = useMemo(() => columnsText.trim().split(/[\s,，]+/).map(Number).filter(value => Number.isInteger(value) && value > 0), [columnsText]);
  const combinationResults = useMemo(() => ({ two: combinations(validBallCount, 2), three: combinations(validBallCount, 3), four: combinations(validBallCount, 4) }), [validBallCount]);
  const columnResults = useMemo(() => ({ two: columnCombinations(columns, 2), three: columnCombinations(columns, 3), four: columnCombinations(columns, 4) }), [columns]);
  const results = mode === "combination" ? combinationResults : columnResults;

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="calculator-heading">
      <div className="border-b border-stone-100 p-5 sm:p-6">
        <p className="eyebrow">COMBINATION LAB</p>
        <h1 id="calculator-heading" className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><Calculator className="size-6 text-red-600" />連碰立柱計算</h1>
      </div>
      {combined ? (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-stone-900"><Calculator className="size-5 text-red-600" />連碰計算器</h2>
            <div className="mt-4 space-y-2"><Label htmlFor="ballCountCombined">選擇球數（2～49）</Label><Input id="ballCountCombined" type="number" min={2} max={49} value={ballCountText} onChange={event => setBallCountText(event.target.value)} placeholder="請輸入 2～49" /></div>
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800"><Info className="mt-0.5 size-4 shrink-0" />依選擇球數計算不重複的二、三、四星組合。</div>
            <ResultPanel results={combinationResults} />
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-stone-900"><Columns3 className="size-5 text-red-600" />立柱計算器</h2>
            <div className="mt-4 space-y-2"><Label htmlFor="columnsCombined">每柱球數（空格分隔）</Label><Input id="columnsCombined" value={columnsText} onChange={event => setColumnsText(event.target.value)} placeholder="例如：3 2 2" /></div>
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800"><Info className="mt-0.5 size-4 shrink-0" />每一星必須從不同柱各取一球，計算跨柱組合數。</div>
            <ResultPanel results={columnResults} />
          </article>
        </div>
      ) : (
        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5">
              {(["combination", "column"] as const).map(value => (
                <Button key={value} type="button" variant="ghost" onClick={() => setMode(value)} className={cn("rounded-xl", mode === value && "bg-white text-red-700 shadow-sm hover:bg-white")}>
                  {value === "combination" ? <Calculator className="size-4" /> : <Columns3 className="size-4" />}{value === "combination" ? "連碰計算" : "立柱計算"}
                </Button>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {mode === "combination" ? <><Label htmlFor="ballCount">選擇球數（2～49）</Label><Input id="ballCount" type="number" min={2} max={49} value={ballCountText} onChange={event => setBallCountText(event.target.value)} placeholder="請輸入 2～49" /></> : <><Label htmlFor="columns">每柱球數（空格分隔）</Label><Input id="columns" value={columnsText} onChange={event => setColumnsText(event.target.value)} placeholder="例如：3 2 2" /></>}
            </div>
            <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800"><Info className="mt-0.5 size-4 shrink-0" />{mode === "combination" ? "依選擇球數計算不重複的二、三、四星組合。" : "每一星必須從不同柱各取一球，計算跨柱組合數。"}</div>
          </div>
          <ResultPanel results={results} />
        </div>
      )}
    </section>
  );
}
