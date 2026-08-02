// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolSidebar } from "./ToolSidebar";

afterEach(cleanup);

const session = {
  user: { id: 1 },
  permissions: {
    trendBoard: true,
    combinationCalculator: true,
    columnCalculator: true,
    distributionChart: true,
    oddEvenRatio: true,
    headNumbers: true,
    missingNumbers: true,
  },
} as any;

describe("ToolSidebar compact layout", () => {
  it("顯示三格入口，展開兩排四項走勢工具並導向合併計算頁", () => {
    const onNavigate = vi.fn();
    render(createElement(ToolSidebar, { lotteryType: "lotto649", session, activeView: "dashboard", activeAnalysis: "distributionChart", showTrendAnalysis: true, onNavigate, onRequireLogin: vi.fn(), compactLayout: true }));
    expect(screen.getByRole("button", { name: /版路拖牌/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /連碰立柱計算/ }));
    expect(onNavigate).toHaveBeenCalledWith("calculator", "combinationCalculator");
    fireEvent.click(screen.getByRole("button", { name: /走勢分析/ }));
    for (const label of ["分布與統計表", "單雙比與和值", "頭數與尾數", "距今未開"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it("切換彩別後仍保持走勢分析父選單展開", () => {
    const props = { session, activeView: "dashboard" as const, activeAnalysis: "distributionChart" as const, showTrendAnalysis: true, onNavigate: vi.fn(), onRequireLogin: vi.fn(), compactLayout: true };
    const view = render(createElement(ToolSidebar, { ...props, lotteryType: "lotto649" }));
    fireEvent.click(screen.getByRole("button", { name: /走勢分析/ }));
    expect(screen.getByRole("button", { name: /距今未開/ })).toBeTruthy();

    view.rerender(createElement(ToolSidebar, { ...props, lotteryType: "superLotto638" }));

    expect(screen.getByRole("button", { name: /走勢分析/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /距今未開/ })).toBeTruthy();
  });
});
