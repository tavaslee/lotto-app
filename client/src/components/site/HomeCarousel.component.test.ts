// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const homeState = vi.hoisted(() => ({ data: undefined as any }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    carousel: {
      publicView: {
        useQuery: () => ({ data: homeState.data }),
      },
    },
  },
}));

import { HomeCarousel } from "./HomeCarousel";

const slides = [
  { id: 1, url: "/first.png", fileName: "first.png" },
  { id: 2, url: "/second.png", fileName: "second.png" },
];

describe("HomeCarousel component", () => {
  beforeEach(() => {
    homeState.data = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not render a blank carousel when display is disabled or no active slide exists", () => {
    homeState.data = {
      settings: { isVisible: false, autoplay: true, intervalMs: 1000 },
      slides,
    };
    const hidden = render(createElement(HomeCarousel));
    expect(hidden.container.querySelector('[aria-label="首頁廣告輪播"]')).toBeNull();
    hidden.unmount();

    homeState.data = {
      settings: { isVisible: true, autoplay: true, intervalMs: 1000 },
      slides: [],
    };
    const empty = render(createElement(HomeCarousel));
    expect(empty.container.querySelector('[aria-label="首頁廣告輪播"]')).toBeNull();
  });

  it("renders active slides and supports arrows and dot navigation", () => {
    homeState.data = {
      settings: { isVisible: true, autoplay: false, intervalMs: 1000 },
      slides,
    };
    render(createElement(HomeCarousel));

    expect(screen.getByAltText("first").getAttribute("src")).toBe("/first.png");
    fireEvent.click(screen.getByRole("button", { name: "下一張輪播圖片" }));
    expect(screen.getByAltText("second").getAttribute("src")).toBe("/second.png");
    fireEvent.click(screen.getByRole("button", { name: "顯示第 1 張圖片" }));
    expect(screen.getByAltText("first").getAttribute("src")).toBe("/first.png");
    fireEvent.click(screen.getByRole("button", { name: "上一張輪播圖片" }));
    expect(screen.getByAltText("second").getAttribute("src")).toBe("/second.png");
  });

  it("supports touch swipe navigation and opens the gesture viewer on a tap", () => {
    homeState.data = {
      settings: { isVisible: true, autoplay: false, intervalMs: 1000 },
      slides,
    };
    render(createElement(HomeCarousel));
    const trigger = screen.getByRole("button", { name: "放大目前輪播圖片" });
    fireEvent.pointerDown(trigger, { pointerId: 1, pointerType: "touch", clientX: 240, clientY: 100 });
    fireEvent.pointerUp(trigger, { pointerId: 1, pointerType: "touch", clientX: 110, clientY: 104 });
    expect(screen.getByAltText("second").getAttribute("src")).toBe("/second.png");

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "second放大預覽" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "返回頁面" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("advances at the configured interval and stays still when autoplay is off", () => {
    vi.useFakeTimers();
    homeState.data = {
      settings: { isVisible: true, autoplay: true, intervalMs: 500 },
      slides,
    };
    const playing = render(createElement(HomeCarousel));
    expect(screen.getByAltText("first").getAttribute("src")).toBe("/first.png");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByAltText("second").getAttribute("src")).toBe("/second.png");
    playing.unmount();

    homeState.data = {
      settings: { isVisible: true, autoplay: false, intervalMs: 500 },
      slides,
    };
    render(createElement(HomeCarousel));
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByAltText("first").getAttribute("src")).toBe("/first.png");
  });
});
