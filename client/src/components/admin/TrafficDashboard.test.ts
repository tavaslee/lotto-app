// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dashboardState = vi.hoisted(() => ({ data: undefined as any, isError: false, error: null as Error | null, isFetching: false, refetch: vi.fn(), inputs: [] as number[] }));
vi.mock("@/lib/trpc", () => ({ trpc: { analytics: { overview: { useQuery: (input: { days: number }) => { dashboardState.inputs.push(input.days); return dashboardState; } } } } }));

import { TrafficDashboard } from "./TrafficDashboard";

const analyticsData = {
  totals: { pageViews: 12, visitors: 5, pagesPerVisitor: 2.4 },
  today: { pageViews: 3, visitors: 2 },
  daily: [{ date: "2026-07-20", pageViews: 4, visitors: 2 }, { date: "2026-07-21", pageViews: 8, visitors: 4 }],
  topPages: [{ path: "/", count: 12 }],
  devices: [{ device: "mobile", count: 9 }, { device: "desktop", count: 3 }],
  referrers: [{ referrer: "直接流量", count: 10 }],
  generatedAt: "2026-07-21T02:00:00.000Z",
};

describe("TrafficDashboard", () => {
  beforeEach(() => { Object.assign(dashboardState, { data: analyticsData, isError: false, error: null, isFetching: false }); dashboardState.refetch.mockReset(); dashboardState.inputs.length = 0; });
  afterEach(cleanup);

  it("顯示真實指標並可切換期間與手動更新", () => {
    render(createElement(TrafficDashboard));
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getByText("75%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "7 天" }));
    expect(dashboardState.inputs).toContain(7);
    fireEvent.click(screen.getByRole("button", { name: /更新/ }));
    expect(dashboardState.refetch).toHaveBeenCalledOnce();
  });

  it("在資料查詢失敗時顯示明確錯誤", () => {
    dashboardState.isError = true;
    dashboardState.error = new Error("暫時無法讀取");
    render(createElement(TrafficDashboard));
    expect(screen.getByText(/流量資料讀取失敗：暫時無法讀取/)).toBeTruthy();
  });
});
