// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useTrendImagesQuery } = vi.hoisted(() => ({
  useTrendImagesQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    trendImages: {
      list: { useQuery: useTrendImagesQuery },
    },
  },
}));

import { TrendGallery } from "./TrendGallery";

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
};

beforeEach(() => {
  setViewportWidth(1024);
  window.history.replaceState({ page: "home" }, "", window.location.href);
  useTrendImagesQuery.mockReturnValue({
    data: [{ id: 1, url: "/long-roadmap.png", caption: "大樂透_長版路圖.png" }],
    isLoading: false,
    isError: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TrendGallery 圖片呈現", () => {
  it("未點擊時圖片佔卡片 95%、固定視窗裁切底部且檔名置中", () => {
    render(createElement(TrendGallery, { lotteryType: "lotto649" }));

    const image = screen.getByAltText("大樂透_長版路圖.png");
    const frame = screen.getByTestId("trend-image-frame");
    const card = image.closest("button")!;
    const caption = within(card).getByText("大樂透_長版路圖.png");

    expect(frame.className).toContain("aspect-[4/3]");
    expect(frame.className).toContain("overflow-hidden");
    expect(frame.className).toContain("justify-center");
    expect(image.className).toContain("w-[95%]");
    expect(image.className).toContain("h-auto");
    expect(image.className).toContain("max-w-none");
    expect(card.className).toContain("text-center");
    expect(caption.className).toContain("text-center");
  });

  it("桌機點擊後以原圖正常大小顯示，不套用手機的顯示模式切換", () => {
    setViewportWidth(1440);
    render(createElement(TrendGallery, { lotteryType: "lotto649" }));
    fireEvent.click(screen.getByAltText("大樂透_長版路圖.png").closest("button")!);

    const dialog = screen.getByRole("dialog", { name: "大樂透_長版路圖.png放大預覽" });
    const viewerImage = within(dialog).getByAltText("大樂透_長版路圖.png");
    const filename = within(dialog).getByTestId("image-viewer-filename");
    const stage = within(dialog).getByTestId("image-viewer-stage");

    expect(stage.className).toContain("justify-center");
    expect(viewerImage.className).toContain("w-auto");
    expect(viewerImage.className).toContain("max-w-none");
    expect(viewerImage.className).toContain("max-h-none");
    expect(filename.textContent).toBe("大樂透_長版路圖.png");
    expect(filename.className).toContain("text-center");
    expect(within(dialog).queryByRole("button", { name: "適合寬度" })).toBeNull();
    expect(within(dialog).getByText("滑鼠滾輪縮放 · 雙擊放大／還原 · 按住拖曳")).toBeTruthy();
  });
});
