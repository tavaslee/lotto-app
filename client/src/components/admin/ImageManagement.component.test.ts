// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const imageState = vi.hoisted(() => ({
  queryInputs: [] as string[],
  driveReset: vi.fn(),
  mutation: vi.fn(),
  mutationAsync: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      trendImages: {
        adminList: {
          invalidate: imageState.invalidate,
          cancel: vi.fn(),
          getData: vi.fn(() => []),
          setData: vi.fn(),
        },
        list: { invalidate: imageState.invalidate },
      },
    }),
    trendImages: {
      adminList: {
        useQuery: ({ lotteryType }: { lotteryType: string }) => {
          imageState.queryInputs.push(lotteryType);
          return { data: [], isError: false, isLoading: false, error: null };
        },
      },
      addUrl: { useMutation: () => ({ mutate: imageState.mutation, isPending: false }) },
      upload: { useMutation: () => ({ mutateAsync: imageState.mutationAsync, isPending: false }) },
      delete: { useMutation: () => ({ mutate: imageState.mutation, isPending: false }) },
      deleteMany: { useMutation: () => ({ mutate: imageState.mutation, isPending: false }) },
      reorder: { useMutation: () => ({ mutate: imageState.mutation, isPending: false }) },
      drivePreview: {
        useMutation: () => ({
          mutate: imageState.mutation,
          reset: imageState.driveReset,
          isPending: false,
          data: null,
        }),
      },
      driveSync: { useMutation: () => ({ mutate: imageState.mutation, isPending: false }) },
    },
  },
}));

vi.mock("./CarouselManagement", () => ({
  CarouselManagement: () => createElement("div", { "data-testid": "carousel-management" }),
}));

vi.mock("./SortableImageGrid", () => ({
  SortableImageGrid: () => null,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ImageManagement } from "./ImageManagement";

describe("ImageManagement 彩別切換", () => {
  beforeEach(() => {
    imageState.queryInputs.length = 0;
    imageState.driveReset.mockReset();
    imageState.mutation.mockReset();
    imageState.mutationAsync.mockReset();
    imageState.invalidate.mockReset();
  });

  afterEach(cleanup);

  it("將五個彩別按鈕放在雲端同步操作區下方與圖片清單上方", () => {
    render(createElement(ImageManagement));

    expect(screen.queryByRole("combobox", { name: "管理彩別" })).toBeNull();
    const selector = screen.getByTestId("trend-lottery-selector");
    const driveSection = screen.getByText("從雲端硬碟匯入圖片").closest("section")!;
    const imageSection = screen.getByRole("heading", { name: "大樂透 圖片" }).closest("section")!;
    expect(driveSection.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(selector.compareDocumentPosition(imageSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const group = screen.getByRole("group", { name: "管理彩別" });
    const buttons = Array.from(group.querySelectorAll("button"));
    expect(buttons.map(button => button.textContent?.replace(/^\d/, ""))).toEqual([
      "大樂透",
      "威力彩",
      "今彩539",
      "六合彩",
      "加州天天樂",
    ]);
  });

  it("點擊彩別按鈕會更新選取狀態與目前圖片標題", () => {
    render(createElement(ImageManagement));

    const superLottoButton = screen.getByRole("button", { name: /威力彩/ });
    fireEvent.click(superLottoButton);

    expect(superLottoButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "威力彩 圖片" })).toBeTruthy();
    expect(imageState.queryInputs.at(-1)).toBe("superLotto638");
    expect(imageState.driveReset).toHaveBeenCalledTimes(1);
  });
});
