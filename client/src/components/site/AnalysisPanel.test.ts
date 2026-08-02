// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  data: undefined as any,
  isLoading: false,
  error: null as Error | null,
  inputs: [] as any[],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    lottery: {
      analysis: {
        useQuery: (input: unknown) => {
          queryState.inputs.push(input);
          return queryState;
        },
      },
    },
  },
}));

import { AnalysisPanel } from "./AnalysisPanel";

const record = {
  id: "lotto649:001",
  issue: "001",
  drawDateRoc: "115.01.01",
  numbers: ["01", "05", "10", "16", "27", "34"],
  specialNumber: "07",
};

function data(includeSpecial: boolean) {
  return {
    records: [record],
    roleLimit: 30,
    totalMatched: 1,
    truncated: false,
    includeSpecial,
    omissionBeforeSelection: Array.from({ length: 49 }, () => 0),
    maxOmission: Array.from({ length: 49 }, () => 9),
  };
}

describe("AnalysisPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12));
    queryState.data = data(true);
    queryState.isLoading = false;
    queryState.error = null;
    queryState.inputs.length = 0;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("提供日期、期數區間或最近期數查詢，並沿用一般會員 30 期提示", () => {
    render(createElement(AnalysisPanel, { lotteryType: "lotto649", tool: "distributionChart", session: undefined }));
    expect(screen.getByText("起始日期")).toBeTruthy();
    expect(screen.getByText("結束日期")).toBeTruthy();
    expect((screen.getByLabelText("起始日期") as HTMLInputElement).value).toBe("2026-07-12");
    expect((screen.getByLabelText("結束日期") as HTMLInputElement).value).toBe("2026-07-22");
    expect(screen.getByText("本帳號最多 30 期")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "期數區間" }));
    expect(screen.getByText("起始期數")).toBeTruthy();
    expect(screen.getByText("結束期數")).toBeTruthy();
    expect(screen.queryByText("起始日期")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查幾期" }));
    const countInput = screen.getByLabelText("查詢期數") as HTMLInputElement;
    expect(countInput.value).toBe("30");
    fireEvent.change(countInput, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "查詢分析" }));
    expect(queryState.inputs.at(-1)).toMatchObject({ rangeMode: "count", count: 12 });
  });

  it("渲染分布矩陣、統計區隔、號碼排名與對應出現次數", () => {
    const { container } = render(createElement(AnalysisPanel, { lotteryType: "lotto649", tool: "distributionChart", session: undefined }));
    expect(screen.getByRole("heading", { name: /分布與統計表/ })).toBeTruthy();
    expect(screen.getByText("開獎日期").className).not.toContain("sticky");
    expect(screen.getByText("次數統計")).toBeTruthy();
    const rankingRow = screen.getByText("號碼排名").closest("tr")!;
    const frequencyRow = screen.getByText("出現次數").closest("tr")!;
    expect(Array.from(rankingRow.querySelectorAll("td")).slice(0, 7).map(cell => cell.textContent)).toEqual(["01", "05", "07", "10", "16", "27", "34"]);
    expect(Array.from(frequencyRow.querySelectorAll("td")).slice(0, 7).map(cell => cell.textContent)).toEqual(["1", "1", "1", "1", "1", "1", "1"]);
    expect(container.querySelectorAll('tr[aria-hidden="true"]').length).toBe(1);
    expect(container.querySelectorAll(".bg-red-500").length).toBe(49);
    expect(container.querySelectorAll('[data-ranking-ball="lotto649"]').length).toBe(98);
    const regularBall = screen.getAllByText("01").find(node => node.tagName === "SPAN") as HTMLElement;
    const specialBall = screen.getAllByText("07").find(node => node.tagName === "SPAN") as HTMLElement;
    expect(regularBall.style.backgroundColor).not.toBe("");
    expect(specialBall.style.backgroundColor).not.toBe(regularBall.style.backgroundColor);
  });

  it("依五彩別顯示淡色號碼球與正確的 49、38、39 個號碼上限", () => {
    const cases = [
      ["lotto649", 49, "rgb(254, 249, 195)"],
      ["superLotto638", 38, "rgb(220, 252, 231)"],
      ["daily539", 39, "rgb(255, 237, 213)"],
      ["markSix", 49, "rgb(254, 226, 226)"],
      ["fantasy5", 39, "rgb(219, 234, 254)"],
    ] as const;

    for (const [lotteryType, maxBall, expectedColor] of cases) {
      queryState.data = data(false);
      const { container, unmount } = render(createElement(AnalysisPanel, { lotteryType, tool: "distributionChart", session: undefined }));
      const balls = container.querySelectorAll<HTMLElement>(`[data-ranking-ball="${lotteryType}"]`);
      expect(balls.length).toBe(maxBall * 2);
      expect(balls[0].style.backgroundColor).toBe(expectedColor);
      unmount();
    }
  });

  it("渲染單雙比與和值，未勾選時保留空白特別號欄且不計入特別號", () => {
    queryState.data = data(false);
    render(createElement(AnalysisPanel, { lotteryType: "lotto649", tool: "oddEvenRatio", session: undefined }));
    expect(screen.getByRole("heading", { name: /單雙比與和值/ })).toBeTruthy();
    expect(screen.getByText("特別號")).toBeTruthy();
    expect(screen.getByText("3:3")).toBeTruthy();
    expect(screen.getByText("93")).toBeTruthy();
    expect(screen.queryByText("07")).toBeNull();
  });

  it("在期數與 0 頭之間列出開獎號碼，並渲染 0 至 4 頭及 0 至 9 尾", () => {
    render(createElement(AnalysisPanel, { lotteryType: "lotto649", tool: "headNumbers", session: undefined }));
    expect(screen.getByRole("heading", { name: /頭數與尾數/ })).toBeTruthy();
    const headerCells = Array.from(screen.getByText("開獎號碼").closest("tr")!.querySelectorAll("th")).map(cell => cell.textContent);
    expect(headerCells.slice(0, 4)).toEqual(["開獎日期", "期數", "開獎號碼", "0頭"]);
    const drawNumbersCell = screen.getByText("001").closest("tr")!.querySelectorAll("td")[2];
    expect(drawNumbersCell.textContent).toBe("01051016273407");
    expect(screen.getByText("0頭")).toBeTruthy();
    expect(screen.getByText("4頭")).toBeTruthy();
    expect(screen.getByText("0尾")).toBeTruthy();
    expect(screen.getByText("9尾")).toBeTruthy();
    const totalCells = Array.from(screen.getByText("總出現次數").closest("tr")!.querySelectorAll("td")).map(cell => cell.textContent);
    expect(totalCells).toEqual(["3", "2", "1", "1", "0", "1", "1", "0", "0", "1", "1", "1", "2", "0", "0"]);
  });

  it("渲染距今未開矩陣、本次排名、完整歷史排名及對應未開次數", () => {
    queryState.data = data(true);
    queryState.data.maxOmission = Array.from({ length: 49 }, () => 0);
    queryState.data.maxOmission[1] = 12;
    queryState.data.maxOmission[4] = 12;
    queryState.data.maxOmission[9] = 11;
    const { container } = render(createElement(AnalysisPanel, { lotteryType: "lotto649", tool: "missingNumbers", session: undefined }));
    expect(screen.getByRole("heading", { name: /距今未開/ })).toBeTruthy();
    expect(screen.getByText("開獎日期").className).not.toContain("sticky");
    const currentRankingRow = screen.getByText("本次號碼排名").closest("tr")!;
    const currentCountRow = screen.getByText("本次統計次數").closest("tr")!;
    const historicalRankingRow = screen.getByText("號碼排名").closest("tr")!;
    const historicalCountRow = screen.getByText("最大未開次數").closest("tr")!;
    expect(Array.from(currentRankingRow.querySelectorAll("td")).slice(0, 5).map(cell => cell.textContent)).toEqual(["02", "03", "04", "06", "08"]);
    expect(Array.from(currentCountRow.querySelectorAll("td")).slice(0, 5).map(cell => cell.textContent)).toEqual(["1", "1", "1", "1", "1"]);
    expect(Array.from(historicalRankingRow.querySelectorAll("td")).slice(0, 3).map(cell => cell.textContent)).toEqual(["02", "05", "10"]);
    expect(Array.from(historicalCountRow.querySelectorAll("td")).slice(0, 3).map(cell => cell.textContent)).toEqual(["12", "12", "11"]);
    expect(container.querySelectorAll('[data-ranking-ball="lotto649"]').length).toBe(98);
    expect(container.querySelectorAll('tr[aria-hidden="true"]').length).toBe(1);
    expect(container.querySelectorAll(".bg-sky-200").length).toBe(7);
    expect(container.querySelectorAll(".bg-yellow-200").length).toBeGreaterThan(0);
  });

  it("一般會員登入後使用近 30 天分析日期預設", () => {
    render(createElement(AnalysisPanel, {
      lotteryType: "lotto649",
      tool: "distributionChart",
      session: { user: { id: 1, role: "user", memberLevel: "regular" } } as any,
    }));
    expect((screen.getByLabelText("起始日期") as HTMLInputElement).value).toBe("2026-06-22");
    expect((screen.getByLabelText("結束日期") as HTMLInputElement).value).toBe("2026-07-22");
  });
});
