// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackerState = vi.hoisted(() => ({ location: "/", mutate: vi.fn() }));

vi.mock("wouter", () => ({ useLocation: () => [trackerState.location, vi.fn()] }));
vi.mock("@/lib/trpc", () => ({ trpc: { analytics: { record: { useMutation: () => ({ mutate: trackerState.mutate }) } } } }));

import { TrafficTracker } from "./TrafficTracker";

describe("TrafficTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackerState.location = "/";
    trackerState.mutate.mockReset();
    localStorage.clear();
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "0" });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("匿名記錄前台路徑與手機裝置", () => {
    render(createElement(TrafficTracker));
    act(() => vi.advanceTimersByTime(450));
    expect(trackerState.mutate).toHaveBeenCalledWith(expect.objectContaining({ path: "/", device: "mobile", referrerHost: null }));
    expect(trackerState.mutate.mock.calls[0][0].visitorId.length).toBeGreaterThanOrEqual(8);
  });

  it("不記錄後台路徑或啟用 Do Not Track 的瀏覽器", () => {
    trackerState.location = "/admin";
    const admin = render(createElement(TrafficTracker));
    act(() => vi.advanceTimersByTime(450));
    expect(trackerState.mutate).not.toHaveBeenCalled();
    admin.unmount();
    trackerState.location = "/";
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" });
    render(createElement(TrafficTracker));
    act(() => vi.advanceTimersByTime(450));
    expect(trackerState.mutate).not.toHaveBeenCalled();
  });
});
