// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Home from "./Home";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const testState = vi.hoisted(() => ({ mobile: true }));

vi.mock("@/hooks/useMobileOrTablet", () => ({ useMobileOrTablet: () => testState.mobile }));
vi.mock("@/components/site/HomeCarousel", () => ({
  HomeCarousel: () => createElement("div", { "data-testid": "mobile-carousel" }, "輪播廣告"),
}));
vi.mock("@/components/site/MobileHomeNavigation", () => ({
  MobileHomeNavigation: ({ onSelectLottery }: { onSelectLottery: (lotteryType: string) => void }) => createElement(
    "div",
    { "data-testid": "mobile-main-menu" },
    "兩排主選單",
    createElement("button", { type: "button", onClick: () => onSelectLottery("superLotto638") }, "手機切換威力彩"),
  ),
}));
vi.mock("@/components/site/ToolSidebar", () => ({
  ToolSidebar: ({ onNavigate }: { onNavigate: (view: string, permission: string) => void }) => createElement(
    "div",
    null,
    createElement("button", { type: "button", onClick: () => onNavigate("trend", "trendBoard") }, "開啟版路拖牌"),
    createElement("button", { type: "button", onClick: () => onNavigate("analysis", "distributionChart") }, "開啟分布與統計表"),
    createElement("button", { type: "button", onClick: () => onNavigate("analysis", "oddEvenRatio") }, "開啟單雙比與和值"),
    createElement("button", { type: "button", onClick: () => onNavigate("analysis", "headNumbers") }, "開啟頭數與尾數"),
    createElement("button", { type: "button", onClick: () => onNavigate("analysis", "missingNumbers") }, "開啟距今未開"),
    createElement("button", { type: "button", onClick: () => onNavigate("calculator", "combinationCalculator") }, "開啟連碰計算器"),
    createElement("button", { type: "button", onClick: () => onNavigate("calculator", "columnCalculator") }, "開啟立柱計算器"),
  ),
}));
vi.mock("@/components/site/AnalysisPanel", () => ({
  AnalysisPanel: ({ lotteryType, tool }: { lotteryType: string; tool: string }) => createElement("div", { "data-testid": "analysis-content" }, `${lotteryType}:${tool}`),
}));
vi.mock("@/components/site/MobileToolBreadcrumb", () => ({ MobileToolBreadcrumb: () => createElement("div", null, "工具麵包屑") }));
vi.mock("@/components/site/SiteHeader", () => ({
  SiteHeader: ({ onSelectLottery, onHome }: { onSelectLottery: (lotteryType: string) => void; onHome: () => void }) => createElement(
    "header",
    null,
    "財神",
    createElement("button", { type: "button", onClick: onHome }, "財神品牌首頁"),
    createElement("button", { type: "button", onClick: () => onSelectLottery("superLotto638") }, "桌機切換威力彩"),
  ),
}));
vi.mock("@/components/site/LatestBoard", () => ({ LatestBoard: () => createElement("div", null, "最新開獎") }));
vi.mock("@/components/site/HistoryTable", () => ({ HistoryTable: () => createElement("div", null, "歷史查詢") }));
vi.mock("@/components/site/TrendGallery", () => ({
  TrendGallery: ({ lotteryType }: { lotteryType: string }) => createElement("div", { "data-testid": "trend-content" }, lotteryType),
}));
vi.mock("@/components/site/CalculatorPanel", () => ({
  CalculatorPanel: ({ initialMode }: { initialMode: string }) => createElement("div", { "data-testid": "calculator-content" }, initialMode),
}));
vi.mock("@/components/site/MemberDialog", () => ({ MemberDialog: () => null }));
vi.mock("@/components/site/MobileLeaveGuard", () => ({ MobileLeaveGuard: () => null }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    memberAuth: { me: { useQuery: () => ({ data: { user: undefined, permissions: {
      trendBoard: true,
      distributionChart: true,
      oddEvenRatio: true,
      headNumbers: true,
      missingNumbers: true,
      combinationCalculator: true,
      columnCalculator: true,
    } } }) } },
    permissions: { siteSettings: { useQuery: () => ({ data: { trendAnalysisVisible: true } }) } },
    lottery: { latestAll: { useQuery: () => ({ data: undefined, isLoading: false, error: null }) } },
  },
}));

describe("Home 響應式工具與彩別切換", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    testState.mobile = true;
    vi.clearAllMocks();
  });

  it("點擊分析工具後仍保留輪播與兩排主選單，並在下方顯示內容", () => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: "開啟分布與統計表" }));
    expect(screen.getByTestId("mobile-carousel")).toBeTruthy();
    expect(screen.getByTestId("mobile-main-menu")).toBeTruthy();
    expect(screen.getByTestId("analysis-content")).toBeTruthy();
  });

  it.each([
    ["開啟分布與統計表", "distributionChart"],
    ["開啟單雙比與和值", "oddEvenRatio"],
    ["開啟頭數與尾數", "headNumbers"],
    ["開啟距今未開", "missingNumbers"],
  ])("手機使用%s後切換彩別仍保留目前分析功能", async (buttonName, permission) => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    fireEvent.click(screen.getByRole("button", { name: "手機切換威力彩" }));
    expect(screen.getByTestId("analysis-content").textContent).toBe(`superLotto638:${permission}`);
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it("手機使用版路拖牌後切換彩別仍停留在版路功能", () => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: "開啟版路拖牌" }));
    fireEvent.click(screen.getByRole("button", { name: "手機切換威力彩" }));
    expect(screen.getByTestId("trend-content").textContent).toBe("superLotto638");
  });

  it.each([
    ["開啟連碰計算器", "combination"],
    ["開啟立柱計算器", "column"],
  ])("電腦使用%s後切換彩別仍保留目前計算器", (buttonName, mode) => {
    testState.mobile = false;
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    fireEvent.click(screen.getByRole("button", { name: "桌機切換威力彩" }));
    expect(screen.getByTestId("calculator-content").textContent).toBe(mode);
  });

  it.each([
    "開啟版路拖牌",
    "開啟分布與統計表",
    "開啟單雙比與和值",
    "開啟頭數與尾數",
    "開啟距今未開",
    "開啟連碰計算器",
    "開啟立柱計算器",
  ])("從%s點擊金元寶財神會返回含最新開獎與歷史查詢的完整主頁", buttonName => {
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    expect(screen.queryByText("最新開獎")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "財神品牌首頁" }));
    expect(screen.getByText("最新開獎")).toBeTruthy();
    expect(screen.getByText("歷史查詢")).toBeTruthy();
  });

  it("電腦版工具頁保留返回大樂透開獎首頁按鈕", () => {
    testState.mobile = false;
    render(createElement(Home));
    fireEvent.click(screen.getByRole("button", { name: "開啟版路拖牌" }));

    expect(screen.getByRole("button", { name: "返回 大樂透 開獎首頁" })).toBeTruthy();
  });
});
