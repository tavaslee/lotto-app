import { cn } from "@/lib/utils";
import type { MemberSession } from "@/types/member";
import {
  ANALYSIS_PERMISSION_KEYS,
  LOTTERY_CONFIG,
  PERMISSION_LABELS,
  type LotteryType,
  type PermissionKey,
} from "@shared/lottery";
import {
  BarChart3,
  Calculator,
  ChevronDown,
  Columns3,
  GalleryHorizontalEnd,
  LockKeyhole,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from "lucide-react";
import React, { useState } from "react";

export type MainView = "dashboard" | "analysis" | "trend" | "calculator";

const analysisTools: Array<{ key: PermissionKey; icon: typeof BarChart3 }> = [
  { key: "distributionChart", icon: BarChart3 },
  { key: "oddEvenRatio", icon: SlidersHorizontal },
  { key: "headNumbers", icon: Columns3 },
  { key: "missingNumbers", icon: Target },
] satisfies Array<{ key: (typeof ANALYSIS_PERMISSION_KEYS)[number]; icon: typeof BarChart3 }>;

export function ToolSidebar({
  lotteryType,
  session,
  activeView,
  activeAnalysis,
  showTrendAnalysis,
  onNavigate,
  onRequireLogin,
  compactLayout,
}: {
  lotteryType: LotteryType;
  session: MemberSession | undefined;
  activeView: MainView;
  activeAnalysis: PermissionKey;
  showTrendAnalysis: boolean;
  onNavigate: (view: MainView, permission?: PermissionKey) => void;
  onRequireLogin: () => void;
  compactLayout: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const canUse = (key: PermissionKey) => Boolean(session?.permissions[key]);
  const activate = (view: MainView, key: PermissionKey) => {
    if (!session?.user) return onRequireLogin();
    if (!canUse(key)) return onNavigate("dashboard", key);
    onNavigate(view, key);
  };
  const activateCombinedCalculator = () => {
    if (!session?.user) return onRequireLogin();
    if (canUse("combinationCalculator")) return onNavigate("calculator", "combinationCalculator");
    if (canUse("columnCalculator")) return onNavigate("calculator", "columnCalculator");
    onNavigate("dashboard", "combinationCalculator");
  };
  const toolClass = (key: PermissionKey, active = false) =>
    cn(
      "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all",
      active ? "bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100" : "text-stone-600 hover:bg-stone-50",
      !canUse(key) && "text-stone-400",
    );

  return (
    <aside className={cn(!compactLayout && "sticky top-[92px] self-start")}>
      <div className={cn("surface-card overflow-hidden", compactLayout ? "p-3 sm:p-4" : "p-5")}>
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <p className="eyebrow">PRO TOOLS</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-black text-stone-900">
              <TrendingUp className="size-5 text-red-600" /> 分析工具區
            </h2>
          </div>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
            {LOTTERY_CONFIG[lotteryType].shortName}
          </span>
        </div>

        {compactLayout ? <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => activate("trend", "trendBoard")}
              className={cn("flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center text-sm font-black leading-tight ring-1 transition-transform active:scale-[.97] sm:text-base", activeView === "trend" ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-stone-700 ring-stone-200", !canUse("trendBoard") && "text-stone-400")}
            >
              <GalleryHorizontalEnd className="size-5" />
              <span>版路拖牌</span>
              {!canUse("trendBoard") ? <LockKeyhole className="size-3.5" /> : null}
            </button>
            <button
              type="button"
              onClick={activateCombinedCalculator}
              className={cn("flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center text-sm font-black leading-tight ring-1 transition-transform active:scale-[.97] sm:text-base", activeView === "calculator" ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-stone-700 ring-stone-200", !canUse("combinationCalculator") && !canUse("columnCalculator") && "text-stone-400")}
            >
              <Calculator className="size-5" />
              <span>連碰立柱計算</span>
              {!canUse("combinationCalculator") && !canUse("columnCalculator") ? <LockKeyhole className="size-3.5" /> : null}
            </button>
            {showTrendAnalysis ? (
              <button
                type="button"
                onClick={() => setExpanded(value => !value)}
                aria-expanded={expanded}
                className={cn("flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center text-sm font-black leading-tight ring-1 transition-transform active:scale-[.97] sm:text-base", activeView === "analysis" ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-stone-700 ring-stone-200")}
              >
                <BarChart3 className="size-5" />
                <span className="flex items-center gap-1">走勢分析<ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} /></span>
              </button>
            ) : <div />}
          </div>
          {showTrendAnalysis && expanded ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
              {analysisTools.map(tool => {
                const Icon = tool.icon;
                return (
                  <button
                    type="button"
                    key={tool.key}
                    onClick={() => activate("analysis", tool.key)}
                    className={cn("flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-bold ring-1", activeView === "analysis" && activeAnalysis === tool.key ? "bg-red-50 text-red-700 ring-red-200" : "bg-stone-50 text-stone-700 ring-stone-200", !canUse(tool.key) && "text-stone-400")}
                  >
                    <Icon className="size-4 shrink-0" /><span>{PERMISSION_LABELS[tool.key]}</span>
                    {!canUse(tool.key) ? <LockKeyhole className="size-3.5 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div> : null}

        {!compactLayout ? <div className="mt-4 space-y-2">
          <button
            type="button"
            className={toolClass("trendBoard", activeView === "trend")}
            onClick={() => activate("trend", "trendBoard")}
          >
            <span className="flex items-center gap-2.5"><GalleryHorizontalEnd className="size-4" />版路拖牌</span>
            {!canUse("trendBoard") ? <LockKeyhole className="size-3.5" /> : null}
          </button>

          {showTrendAnalysis ? <div className="rounded-xl border border-stone-100">
            <button
              type="button"
              onClick={() => setExpanded(value => !value)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-bold text-stone-700"
              aria-expanded={expanded}
            >
              <span className="flex items-center gap-2.5"><BarChart3 className="size-4 text-stone-500" />走勢分析</span>
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded ? (
              <div className="space-y-0.5 border-t border-stone-100 p-1.5">
                {analysisTools.map(tool => {
                    const Icon = tool.icon;
                    return (
                      <button
                        type="button"
                        key={tool.key}
                        onClick={() => activate("analysis", tool.key)}
                        className={toolClass(tool.key, activeView === "analysis" && activeAnalysis === tool.key)}
                      >
                        <span className="flex items-center gap-2.5"><Icon className="size-4" />{PERMISSION_LABELS[tool.key]}</span>
                        {!canUse(tool.key) ? <LockKeyhole className="size-3.5" /> : null}
                      </button>
                    );
                  })}
              </div>
            ) : null}
          </div> : null}

          <div className="my-3 h-px bg-stone-100" />
          <button
            type="button"
            className={toolClass("combinationCalculator", activeView === "calculator")}
            onClick={() => activate("calculator", "combinationCalculator")}
          >
            <span className="flex items-center gap-2.5"><Calculator className="size-4" />連碰計算器</span>
            {!canUse("combinationCalculator") ? <LockKeyhole className="size-3.5" /> : null}
          </button>
          <button
            type="button"
            className={toolClass("columnCalculator", activeView === "calculator")}
            onClick={() => activate("calculator", "columnCalculator")}
          >
            <span className="flex items-center gap-2.5"><Columns3 className="size-4" />立柱計算器</span>
            {!canUse("columnCalculator") ? <LockKeyhole className="size-3.5" /> : null}
          </button>
        </div> : null}
      </div>

    </aside>
  );
}
