import { AnalysisPanel } from "@/components/site/AnalysisPanel";
import { CalculatorPanel } from "@/components/site/CalculatorPanel";
import { ContactDialog } from "@/components/site/ContactDialog";
import { HistoryTable } from "@/components/site/HistoryTable";
import { HomeCarousel } from "@/components/site/HomeCarousel";
import { LatestBoard } from "@/components/site/LatestBoard";
import { MemberDialog } from "@/components/site/MemberDialog";
import { MobileHomeNavigation } from "@/components/site/MobileHomeNavigation";
import { MobileLeaveGuard } from "@/components/site/MobileLeaveGuard";
import { MobileToolBreadcrumb } from "@/components/site/MobileToolBreadcrumb";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ToolSidebar, type MainView } from "@/components/site/ToolSidebar";
import { TrendGallery } from "@/components/site/TrendGallery";
import { useMobileOrTablet } from "@/hooks/useMobileOrTablet";
import { trpc } from "@/lib/trpc";
import {
  LOTTERY_CONFIG,
  PERMISSION_LABELS,
  type LotteryType,
  type PermissionKey,
} from "@shared/lottery";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const isMobileOrTablet = useMobileOrTablet();
  const [selectedLottery, setSelectedLottery] = useState<LotteryType>("lotto649");
  const [activeView, setActiveView] = useState<MainView>("dashboard");
  const [activeAnalysis, setActiveAnalysis] = useState<PermissionKey>("distributionChart");
  const [calculatorMode, setCalculatorMode] = useState<"combination" | "column">("combination");
  const [memberOpen, setMemberOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const toolContentRef = useRef<HTMLDivElement>(null);
  const sessionQuery = trpc.memberAuth.me.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const siteSettingsQuery = trpc.permissions.siteSettings.useQuery(undefined, { refetchInterval: 60_000 });
  const trendAnalysisVisible = siteSettingsQuery.data?.trendAnalysisVisible ?? true;
  const latestQuery = trpc.lottery.latestAll.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });
  const visibleLotteryTypes = sessionQuery.data?.user?.role !== "admin" && sessionQuery.data?.user?.memberLevel === "premium"
    ? sessionQuery.data.user.allowedLotteryTypes
    : undefined;

  const selectLottery = (lotteryType: LotteryType) => {
    const member = sessionQuery.data?.user;
    if (member?.role !== "admin" && member?.memberLevel === "premium" && !member.allowedLotteryTypes.includes(lotteryType)) {
      toast.error("此會員尚未開放此彩別", { description: "請洽管理員調整付費會員可用彩別。" });
      return;
    }
    setSelectedLottery(lotteryType);
  };

  const navigate = (view: MainView, permission?: PermissionKey) => {
    if (view === "analysis" && !trendAnalysisVisible) {
      toast.error("走勢分析目前未在前台開放");
      return;
    }
    if (permission && !sessionQuery.data?.permissions[permission]) {
      toast.error("此功能目前未開放", {
        description: sessionQuery.data?.user
          ? `${PERMISSION_LABELS[permission]}不在目前會員等級或客製權限中，請洽管理員。`
          : "請先登入會員帳號。",
      });
      if (!sessionQuery.data?.user) setMemberOpen(true);
      return;
    }
    if (view === "analysis" && permission) setActiveAnalysis(permission);
    if (view === "calculator") {
      setCalculatorMode(permission === "columnCalculator" ? "column" : "combination");
    }
    setActiveView(view);
  };

  useEffect(() => {
    if (!trendAnalysisVisible && activeView === "analysis") setActiveView("dashboard");
  }, [activeView, trendAnalysisVisible]);

  useEffect(() => {
    const member = sessionQuery.data?.user;
    if (member?.role !== "admin" && member?.memberLevel === "premium" && !member.allowedLotteryTypes.includes(selectedLottery)) {
      setSelectedLottery(member.allowedLotteryTypes[0] ?? "lotto649");
      setActiveView("dashboard");
    }
  }, [selectedLottery, sessionQuery.data?.user]);

  useEffect(() => {
    if (!isMobileOrTablet || activeView === "dashboard") return;
    const frame = window.requestAnimationFrame(() => {
      toolContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeAnalysis, activeView, calculatorMode, isMobileOrTablet, selectedLottery]);

  const returnToHome = () => {
    setActiveView("dashboard");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader
        selectedLottery={selectedLottery}
        onSelectLottery={selectLottery}
        onHome={returnToHome}
        session={sessionQuery.data}
        onOpenMember={() => setMemberOpen(true)}
        onOpenContact={() => setContactOpen(true)}
        compactLayout={isMobileOrTablet}
      />

      <main className={`container ${isMobileOrTablet ? "py-3 sm:py-5" : "py-8"}`}>
        {activeView !== "dashboard" && !isMobileOrTablet ? (
          <button
            type="button"
            onClick={returnToHome}
            className="mb-4 inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-bold text-stone-500 transition-colors hover:text-red-700"
          >
            <ArrowLeft className="size-4" />返回 {LOTTERY_CONFIG[selectedLottery].name} 開獎首頁
          </button>
        ) : null}

        <div className={`grid ${isMobileOrTablet ? "gap-4 sm:gap-5" : "grid-cols-[280px_minmax(0,1fr)] gap-6"}`}>
          {isMobileOrTablet ? (
            <>
              <div className="order-1"><HomeCarousel /></div>
              <div className="order-2">
                <MobileHomeNavigation
                  selectedLottery={selectedLottery}
                  session={sessionQuery.data}
                  onSelectLottery={selectLottery}
                />
              </div>
            </>
          ) : activeView === "dashboard" ? <div className="col-start-2 row-start-1"><HomeCarousel /></div> : null}

          {isMobileOrTablet && activeView !== "dashboard" ? (
            <div className="order-3 sticky top-[68px] z-30 self-start">
              <MobileToolBreadcrumb
                activeView={activeView}
                activeAnalysis={activeAnalysis}
                onHome={returnToHome}
              />
            </div>
          ) : null}

          <div className={isMobileOrTablet ? (activeView === "dashboard" ? "order-3" : "order-4") : `col-start-1 row-start-1 ${activeView === "dashboard" ? "row-span-2" : ""}`}>
            <ToolSidebar
              lotteryType={selectedLottery}
              session={sessionQuery.data}
              activeView={activeView}
              activeAnalysis={activeAnalysis}
              showTrendAnalysis={trendAnalysisVisible}
              onNavigate={navigate}
              onRequireLogin={() => setMemberOpen(true)}
              compactLayout={isMobileOrTablet}
            />
          </div>

          <div
            ref={toolContentRef}
            className={isMobileOrTablet ? `${activeView === "dashboard" ? "order-4" : "order-5"} min-w-0 scroll-mt-32 space-y-6` : `col-start-2 min-w-0 space-y-6 ${activeView === "dashboard" ? "row-start-2" : "row-start-1"}`}
          >
            {activeView === "dashboard" ? (
              <>
                <LatestBoard data={latestQuery.data} loading={latestQuery.isLoading} error={Boolean(latestQuery.error)} visibleLotteryTypes={visibleLotteryTypes} />
                <HistoryTable
                  lotteryType={selectedLottery}
                  session={sessionQuery.data}
                  onOpenMember={() => setMemberOpen(true)}
                />
              </>
            ) : activeView === "trend" ? (
              <TrendGallery lotteryType={selectedLottery} />
            ) : activeView === "calculator" ? (
              <CalculatorPanel key={`${calculatorMode}-${isMobileOrTablet}`} initialMode={calculatorMode} combined={isMobileOrTablet} />
            ) : (
              <AnalysisPanel lotteryType={selectedLottery} tool={activeAnalysis} session={sessionQuery.data} />
            )}
          </div>
        </div>
      </main>

      <footer className="mt-8 border-t border-stone-200/70 bg-white/70">
        <div className="container flex flex-col justify-between gap-3 py-6 text-xs text-stone-400 sm:flex-row sm:items-center">
          <p className="font-semibold">© 2026 財神樂透資訊平台 · 開獎資料僅供資訊參考</p>
          <div className="flex items-center gap-3">
            <p className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" />會員密碼請妥善保存</p>
            <MobileLeaveGuard enabled={isMobileOrTablet} />
          </div>
        </div>
      </footer>

      <MemberDialog open={memberOpen} onOpenChange={setMemberOpen} session={sessionQuery.data} />
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}
