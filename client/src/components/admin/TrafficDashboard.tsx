import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BarChart3, Eye, MousePointerClick, RefreshCw, Smartphone, UsersRound } from "lucide-react";
import React, { useMemo, useState } from "react";

const DEVICE_LABEL = { desktop: "桌機", mobile: "手機", tablet: "平板" } as const;
const PERIODS = [7, 30, 90] as const;

export function TrafficDashboard() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const analytics = trpc.analytics.overview.useQuery({ days }, { refetchOnWindowFocus: false });
  const data = analytics.data;
  const maxDaily = Math.max(1, ...(data?.daily.map(item => item.pageViews) ?? [1]));
  const deviceTotal = data?.devices.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const cards = [
    { label: "瀏覽量 PV", value: data?.totals.pageViews ?? "—", detail: `今日 ${data?.today.pageViews ?? 0}`, icon: Eye, tone: "bg-violet-50 text-violet-700" },
    { label: "訪客 UV", value: data?.totals.visitors ?? "—", detail: `今日 ${data?.today.visitors ?? 0}`, icon: UsersRound, tone: "bg-sky-50 text-sky-700" },
    { label: "人均瀏覽", value: data?.totals.pagesPerVisitor ?? "—", detail: "PV ÷ UV", icon: MousePointerClick, tone: "bg-orange-50 text-orange-700" },
    { label: "手機占比", value: deviceTotal ? `${Math.round(((data?.devices.find(item => item.device === "mobile")?.count ?? 0) / deviceTotal) * 100)}%` : "—", detail: "依實際裝置", icon: Smartphone, tone: "bg-emerald-50 text-emerald-700" },
  ];

  const labelIndexes = useMemo(() => new Set([0, Math.floor((data?.daily.length ?? 1) / 2), (data?.daily.length ?? 1) - 1]), [data?.daily.length]);

  return (
    <section className="space-y-4" aria-labelledby="traffic-dashboard-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">SITE ANALYTICS</p><h3 id="traffic-dashboard-heading" className="mt-1 text-xl font-black text-stone-950">網站流量儀表板</h3><p className="mt-1 text-xs font-semibold text-stone-400">第一方匿名統計，不保存 IP 或個人資料；數據自本功能上線後開始累積。</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-stone-100 p-1">{PERIODS.map(period => <button key={period} type="button" onClick={() => setDays(period)} className={`rounded-lg px-3 py-1.5 text-xs font-black transition-colors ${days === period ? "bg-white text-red-700 shadow-sm" : "text-stone-500"}`}>{period} 天</button>)}</div>
          <Button size="sm" variant="outline" onClick={() => void analytics.refetch()} disabled={analytics.isFetching}><RefreshCw className={`size-3.5 ${analytics.isFetching ? "animate-spin" : ""}`} />更新</Button>
        </div>
      </div>

      {analytics.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">流量資料讀取失敗：{analytics.error.message}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <article key={card.label} className="surface-card p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-stone-400">{card.label}</p><p className="mt-2 text-3xl font-black text-stone-950">{card.value}</p><p className="mt-1 text-xs font-semibold text-stone-400">{card.detail}</p></div><span className={`grid size-10 place-items-center rounded-xl ${card.tone}`}><Icon className="size-5" /></span></div></article>; })}</div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
        <article className="surface-card p-5"><div className="mb-5 flex items-center justify-between"><div><h4 className="font-black text-stone-900">每日流量趨勢</h4><p className="mt-1 text-xs text-stone-400">紫色為 PV，藍色為 UV</p></div><BarChart3 className="size-5 text-violet-600" /></div>
          <div className="flex h-56 items-end gap-1.5 border-b border-stone-200 px-1">{(data?.daily ?? []).map((item, index) => <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${item.date}｜PV ${item.pageViews}｜UV ${item.visitors}`}><div className="relative w-full max-w-5 rounded-t bg-violet-200 transition-colors group-hover:bg-violet-400" style={{ height: `${Math.max(item.pageViews ? 4 : 0, (item.pageViews / maxDaily) * 100)}%` }}><div className="absolute inset-x-[25%] bottom-0 rounded-t bg-sky-600" style={{ height: `${item.pageViews ? (item.visitors / item.pageViews) * 100 : 0}%` }} /></div>{labelIndexes.has(index) ? <span className="absolute -bottom-6 whitespace-nowrap text-[9px] font-semibold text-stone-400">{item.date.slice(5)}</span> : null}</div>)}</div>
          {!data?.totals.pageViews ? <p className="mt-9 text-center text-xs font-semibold text-stone-400">尚無流量資料；正式訪客開啟前台後會開始累積。</p> : <p className="mt-9 text-right text-[10px] font-semibold text-stone-400">更新於 {new Date(data.generatedAt).toLocaleString("zh-TW")}</p>}
        </article>

        <article className="surface-card overflow-hidden"><div className="border-b p-5"><h4 className="font-black text-stone-900">熱門頁面</h4><p className="mt-1 text-xs text-stone-400">依瀏覽次數排序</p></div><div className="divide-y">{data?.topPages.length ? data.topPages.map((item, index) => <div key={item.path} className="flex items-center gap-3 px-5 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-stone-100 text-xs font-black text-stone-500">{index + 1}</span><code className="min-w-0 flex-1 truncate text-xs font-bold text-stone-700">{item.path}</code><strong className="text-sm text-stone-900">{item.count}</strong></div>) : <p className="p-6 text-center text-xs font-semibold text-stone-400">尚無資料</p>}</div></article>
      </div>

      <div className="grid gap-4 md:grid-cols-2"><article className="surface-card p-5"><h4 className="font-black text-stone-900">裝置分布</h4><div className="mt-4 space-y-3">{data?.devices.length ? data.devices.map(item => { const percent = deviceTotal ? Math.round((item.count / deviceTotal) * 100) : 0; return <div key={item.device}><div className="mb-1 flex justify-between text-xs font-bold text-stone-600"><span>{DEVICE_LABEL[item.device]}</span><span>{item.count} · {percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} /></div></div>; }) : <p className="text-xs font-semibold text-stone-400">尚無資料</p>}</div></article><article className="surface-card p-5"><h4 className="font-black text-stone-900">流量來源</h4><div className="mt-4 space-y-2">{data?.referrers.length ? data.referrers.map(item => <div key={item.referrer} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"><span className="min-w-0 truncate font-semibold text-stone-600">{item.referrer}</span><strong className="ml-3 text-stone-900">{item.count}</strong></div>) : <p className="text-xs font-semibold text-stone-400">尚無資料</p>}</div></article></div>
    </section>
  );
}
