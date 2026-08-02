// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GestureImageViewer, clampImageScale, pointDistance } from "./GestureImageViewer";

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true });
};

beforeEach(() => {
  setViewportWidth(1024);
  window.history.replaceState({ page: "home" }, "", window.location.href);
  document.body.style.overflow = "auto";
  delete document.body.dataset.caishenImageViewerOpen;
  delete document.body.dataset.caishenImageViewerClosing;
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  delete document.body.dataset.caishenImageViewerOpen;
  delete document.body.dataset.caishenImageViewerClosing;
});

function StatefulViewer() {
  const [open, setOpen] = useState(true);
  return createElement(GestureImageViewer, {
    open,
    src: "/trend.png",
    alt: "版路圖",
    onClose: () => setOpen(false),
  });
}

function NavigationViewer({ startIndex = 0 }: { startIndex?: number }) {
  const images = ["第一張", "第二張", "第三張"];
  const [index, setIndex] = useState(startIndex);
  return createElement(GestureImageViewer, {
    open: true,
    src: `/trend-${index + 1}.png`,
    alt: images[index],
    canPrevious: index > 0,
    canNext: index < images.length - 1,
    onPrevious: () => setIndex(value => Math.max(0, value - 1)),
    onNext: () => setIndex(value => Math.min(images.length - 1, value + 1)),
    onClose: vi.fn(),
  });
}

describe("GestureImageViewer", () => {
  it("提供自然縮放而不顯示加減、旋轉或叉叉輔助按鈕", () => {
    const onClose = vi.fn();
    render(createElement(GestureImageViewer, { open: true, src: "/trend.png", alt: "版路圖", onClose }));
    expect(screen.getByRole("dialog", { name: "版路圖放大預覽" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "返回頁面" }).textContent).toContain("返回");
    expect(screen.getByText("滑鼠滾輪／雙指縮放 · 放大後拖曳 · 點一下切換大小")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+" })).toBeNull();
    expect(screen.queryByRole("button", { name: "-" })).toBeNull();
    expect(screen.queryByRole("button", { name: "⟳" })).toBeNull();

    const image = screen.getByAltText("版路圖");
    const filename = screen.getByTestId("image-viewer-filename");
    expect(image.className).toContain("w-auto");
    expect(image.className).toContain("max-w-[95%]");
    expect(image.className).toContain("max-h-[95%]");
    expect(filename.textContent).toBe("版路圖");
    expect(filename.className).toContain("text-center");
    fireEvent.click(image.parentElement!);
    expect(image.getAttribute("style")).toContain("scale(2)");
    fireEvent.click(image.parentElement!);
    expect(image.getAttribute("style")).toContain("scale(1)");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("手機維持完整圖片預設、適合寬度切換與觸控友善縮放", () => {
    render(createElement(GestureImageViewer, { open: true, src: "/long-trend.png", alt: "長版路圖", desktopNativeSize: true, onClose: vi.fn() }));

    const image = screen.getByAltText("長版路圖");
    const stage = screen.getByTestId("image-viewer-stage");
    const fitWidthButton = screen.getByRole("button", { name: "適合寬度" });
    const fullImageButton = screen.getByRole("button", { name: "完整圖片" });

    expect(fullImageButton.getAttribute("aria-pressed")).toBe("true");
    expect(image.className).toContain("w-auto");
    expect(image.className).toContain("max-h-[95%]");
    expect(image.className).toContain("max-w-[95%]");

    fireEvent.click(fitWidthButton);
    expect(fitWidthButton.getAttribute("aria-pressed")).toBe("true");
    expect(image.className).toContain("w-[95%]");
    expect(image.className).toContain("max-h-none");
    expect(image.getAttribute("style")).toContain("scale(1)");

    fireEvent.wheel(stage, { deltaY: -120, clientX: 200, clientY: 180 });
    expect(image.getAttribute("style")).not.toContain("scale(1)");

    fireEvent.click(fullImageButton);
    expect(fullImageButton.getAttribute("aria-pressed")).toBe("true");
    expect(image.className).toContain("max-h-[95%]");
    expect(image.getAttribute("style")).toContain("scale(1)");
  });

  it("桌機版路燈箱以原始像素尺寸開啟，支援滾輪、雙擊與 100% 全方向拖曳", () => {
    setViewportWidth(1440);
    render(createElement(GestureImageViewer, {
      open: true,
      src: "/native-roadmap.png",
      alt: "原圖版路",
      desktopNativeSize: true,
      onClose: vi.fn(),
    }));

    const image = screen.getByAltText("原圖版路");
    const stage = screen.getByTestId("image-viewer-stage");

    expect(image.className).toContain("w-auto");
    expect(image.className).toContain("max-w-none");
    expect(image.className).toContain("max-h-none");
    expect(screen.queryByRole("button", { name: "適合寬度" })).toBeNull();
    expect(screen.getByText("滑鼠滾輪縮放 · 雙擊放大／還原 · 按住拖曳")).toBeTruthy();

    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 200, clientY: 180 });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: "mouse", buttons: 1, clientX: 245, clientY: 218 });
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 245, clientY: 218 });
    expect(image.getAttribute("style")).toContain("translate3d(45px, 38px, 0) scale(1)");

    fireEvent.doubleClick(stage, { clientX: 240, clientY: 200 });
    expect(image.getAttribute("style")).toContain("scale(2)");
    fireEvent.doubleClick(stage, { clientX: 240, clientY: 200 });
    expect(image.getAttribute("style")).toContain("translate3d(0px, 0px, 0) scale(1)");

    fireEvent.wheel(stage, { deltaY: -120, clientX: 240, clientY: 200 });
    expect(image.getAttribute("style")).not.toContain("scale(1)");
  });

  it("即使從會裁切與建立堆疊上下文的卡片開啟，縮放後仍將返回控制項固定掛載於頁面最上層", () => {
    const onClose = vi.fn();
    render(createElement(
      "section",
      { className: "surface-card overflow-hidden", style: { backdropFilter: "blur(12px)" } },
      createElement(GestureImageViewer, { open: true, src: "/trend.png", alt: "版路圖", onClose }),
    ));

    const dialog = screen.getByRole("dialog", { name: "版路圖放大預覽" });
    const returnButton = screen.getByRole("button", { name: "返回頁面" });
    const image = screen.getByAltText("版路圖");

    expect(dialog.parentElement).toBe(document.body);
    fireEvent.click(image.parentElement!);
    expect(image.getAttribute("style")).toContain("scale(2)");
    expect(returnButton.isConnected).toBe(true);
    expect(returnButton.closest('[role="dialog"]')).toBe(dialog);

    fireEvent.click(returnButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("限制縮放倍率並正確計算雙指距離", () => {
    expect(clampImageScale(0.5)).toBe(1);
    expect(clampImageScale(2.5)).toBe(2.5);
    expect(clampImageScale(9)).toBe(5);
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("手機或瀏覽器倒退鍵只關閉燈箱並恢復頁面捲動與操作", () => {
    render(createElement(StatefulViewer));

    expect(screen.getByRole("dialog", { name: "版路圖放大預覽" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.dataset.caishenImageViewerOpen).toBe("true");
    expect(window.history.state.__caishenImageViewer).toBe(true);

    fireEvent.popState(window, { state: { page: "home" } });

    expect(screen.queryByRole("dialog", { name: "版路圖放大預覽" })).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.dataset.caishenImageViewerOpen).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("桌機控制位於圖片舞台外，第一張沒有上一張且最後一張沒有下一張", () => {
    render(createElement(NavigationViewer));
    const stage = screen.getByTestId("image-viewer-stage");

    expect(screen.queryByRole("button", { name: "上一張圖片" })).toBeNull();
    const firstNext = screen.getByRole("button", { name: "下一張圖片" });
    expect(stage.contains(firstNext)).toBe(false);
    expect(firstNext.closest('[data-testid="next-image-control-slot"]')).toBeTruthy();

    fireEvent.click(firstNext);
    expect(screen.getByAltText("第二張")).toBeTruthy();
    expect(screen.getByRole("button", { name: "上一張圖片" }).textContent).toContain("上一張");
    fireEvent.click(screen.getByRole("button", { name: "下一張圖片" }));

    expect(screen.getByAltText("第三張")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "下一張圖片" })).toBeNull();
    expect(stage.contains(screen.getByRole("button", { name: "上一張圖片" }))).toBe(false);
  });

  it("手機向左滑顯示下一張、向右滑顯示上一張", () => {
    render(createElement(NavigationViewer, { startIndex: 1 }));
    let stage = screen.getByTestId("image-viewer-stage");
    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: "touch", clientX: 260, clientY: 240 });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: "touch", clientX: 170, clientY: 244 });
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: "touch", clientX: 170, clientY: 244 });
    expect(screen.getByAltText("第三張")).toBeTruthy();

    stage = screen.getByTestId("image-viewer-stage");
    fireEvent.pointerDown(stage, { pointerId: 2, pointerType: "touch", clientX: 120, clientY: 240 });
    fireEvent.pointerMove(stage, { pointerId: 2, pointerType: "touch", clientX: 215, clientY: 237 });
    fireEvent.pointerUp(stage, { pointerId: 2, pointerType: "touch", clientX: 215, clientY: 237 });
    expect(screen.getByAltText("第二張")).toBeTruthy();
  });
});
