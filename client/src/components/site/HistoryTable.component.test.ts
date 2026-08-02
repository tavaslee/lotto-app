// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DrawRecord } from "@shared/lottery";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSession } from "@/types/member";

const historyState = vi.hoisted(() => ({ data: [] as DrawRecord[] }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    lottery: {
      history: {
        useQuery: () => ({
          data: historyState.data,
          isLoading: false,
          isError: false,
          error: null,
        }),
      },
    },
  },
}));

vi.mock("./LotteryBalls", () => ({ LotteryBalls: () => null }));

import { HistoryTable } from "./HistoryTable";

const session = {
  user: {
    id: "admin-1",
    role: "admin",
    memberLevel: "premium",
  },
} as unknown as MemberSession;

function draw(issue: string, drawDateIso: string): DrawRecord {
  return {
    id: issue,
    lotteryType: "lotto649",
    issue,
    drawDateRoc: drawDateIso,
    drawDateIso,
    numbers: ["01", "02", "03", "04", "05", "06"],
    specialNumber: "07",
    status: "active",
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

describe("HistoryTable", () => {
  afterEach(() => {
    cleanup();
    historyState.data = [];
  });

  it("將最舊一期顯示在第一列、最新一期顯示在最後一列", () => {
    historyState.data = [
      draw("202600010", "2026-07-03"),
      draw("202600008", "2026-07-01"),
      draw("202600009", "2026-07-02"),
    ];

    const { container } = render(createElement(HistoryTable, {
      lotteryType: "lotto649",
      session,
      onOpenMember: vi.fn(),
    }));
    const issues = Array.from(container.querySelectorAll("tbody tr")).map(
      row => row.querySelector("td")?.textContent,
    );

    expect(issues).toEqual(["202600008", "202600009", "202600010"]);
  });

  it("可切換新到舊，提供指定對齊並移除資料狀態欄", () => {
    historyState.data = [
      draw("202600010", "2026-07-03"),
      draw("202600008", "2026-07-01"),
      draw("202600009", "2026-07-02"),
    ];

    const { container } = render(createElement(HistoryTable, {
      lotteryType: "lotto649",
      session,
      onOpenMember: vi.fn(),
    }));
    const lotteryName = screen.getByText("大樂透");
    const historyHeading = screen.getByRole("heading", { name: "歷史開獎查詢" });
    const archiveLabel = screen.getAllByText("DRAW ARCHIVE")[0];
    expect(historyHeading.className).toContain("justify-start");
    expect(historyHeading.className).toContain("text-left");
    expect(historyHeading.parentElement?.className).toContain("lg:justify-start");
    expect(historyHeading.parentElement?.parentElement?.className).toContain("lg:text-left");
    expect(lotteryName.className).toContain("lg:text-3xl");
    expect(lotteryName.className).toContain("text-[22px]");
    expect(lotteryName.className).toContain("text-right");
    expect(lotteryName.className).toContain("lg:col-start-3");
    expect(archiveLabel.nextElementSibling?.textContent).toBe("DRAW ARCHIVE");
    expect(archiveLabel.nextElementSibling?.className).toContain("invisible");
    expect(lotteryName.getAttribute("style")).toContain("-webkit-text-stroke: 1px #1c1917");
    expect(screen.getByLabelText("起始日期").parentElement?.className).toContain("grid-cols-2");
    expect(screen.getByRole("button", { name: "查詢" }).parentElement?.className).toContain("grid-cols-2");

    const sortButtons = screen.getAllByRole("button", { name: "目前排序：舊到新，點擊切換" });
    expect(sortButtons).toHaveLength(2);
    expect(sortButtons.every(button => button.className.includes("justify-start"))).toBe(true);
    expect(sortButtons.some(button => button.className.includes("lg:hidden"))).toBe(true);
    expect(sortButtons.some(button => button.className.includes("lg:inline-flex"))).toBe(true);
    expect(screen.queryByText("資料狀態")).toBeNull();
    expect(screen.queryByText("已發布")).toBeNull();
    expect(container.querySelectorAll("thead th")).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr:first-child td")).toHaveLength(3);
    fireEvent.click(sortButtons[0]);

    const issues = Array.from(container.querySelectorAll("tbody tr")).map(
      row => row.querySelector("td")?.textContent,
    );
    expect(issues).toEqual(["202600010", "202600009", "202600008"]);
    expect(screen.getAllByRole("button", { name: "目前排序：新到舊，點擊切換" })).toHaveLength(2);
  });
});
