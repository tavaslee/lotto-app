// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { LOTTERY_TYPES, type DrawRecord } from "@shared/lottery";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouterOutputs } from "@/types/member";

vi.mock("./LotteryBalls", () => ({ LotteryBalls: () => null }));

import { LatestBoard } from "./LatestBoard";

describe("LatestBoard", () => {
  afterEach(cleanup);

  it("五彩別手機日期都與期數同列最右側，桌機日期仍保留下一行", () => {
    const data = Object.fromEntries(LOTTERY_TYPES.map((lotteryType, index) => {
      const day = String(20 + index).padStart(2, "0");
      const record: DrawRecord = {
        id: lotteryType,
        lotteryType,
        issue: `2026000${index + 1}`,
        drawDateRoc: `115.07.${day}`,
        drawDateIso: `2026-07-${day}`,
        numbers: ["01", "02", "03", "04", "05"],
        specialNumber: null,
        status: "active",
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:00:00.000Z",
      };
      return [lotteryType, record];
    })) as unknown as RouterOutputs["lottery"]["latestAll"];

    render(createElement(LatestBoard, { data, loading: false }));

    LOTTERY_TYPES.forEach((_, index) => {
      const issue = screen.getByText(`第 2026000${index + 1} 期`);
      const dates = screen.getAllByText(`民國 115.07.${String(20 + index).padStart(2, "0")}`);
      const mobileDate = dates.find(element => element.className.includes("sm:hidden"));
      const desktopDate = dates.find(element => element.className.includes("sm:flex"));

      expect(mobileDate?.parentElement).toBe(issue.parentElement);
      expect(mobileDate?.className).toContain("ml-auto");
      expect(desktopDate?.className).toContain("hidden");
    });
  });
});

