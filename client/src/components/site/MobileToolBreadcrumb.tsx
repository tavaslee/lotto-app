import { PERMISSION_LABELS, type PermissionKey } from "@shared/lottery";
import { ChevronRight, Home } from "lucide-react";
import React from "react";
import type { MainView } from "./ToolSidebar";

export function MobileToolBreadcrumb({
  activeView,
  activeAnalysis,
  onHome,
}: {
  activeView: Exclude<MainView, "dashboard">;
  activeAnalysis: PermissionKey;
  onHome: () => void;
}) {
  const category = activeView === "analysis" ? "走勢分析" : null;
  const current = activeView === "analysis"
    ? PERMISSION_LABELS[activeAnalysis]
    : activeView === "trend"
      ? "版路拖牌"
      : "連碰立柱計算";

  return (
    <nav
      aria-label="分析工具導航"
      className="flex min-h-11 items-center gap-1 overflow-x-auto rounded-2xl border border-orange-200/80 bg-white/95 px-3 py-2 text-sm font-bold shadow-lg shadow-orange-950/5 backdrop-blur"
    >
      <button
        type="button"
        onClick={onHome}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-red-700 transition-colors hover:bg-red-50 active:bg-red-100"
      >
        <Home className="size-4" />回首頁
      </button>
      <ChevronRight className="size-4 shrink-0 text-orange-400" aria-hidden="true" />
      {category ? (
        <>
          <span className="shrink-0 text-stone-600">{category}</span>
          <ChevronRight className="size-4 shrink-0 text-orange-400" aria-hidden="true" />
        </>
      ) : null}
      <span className="shrink-0 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-2.5 py-1.5 text-white shadow-sm">
        {current}
      </span>
    </nav>
  );
}
