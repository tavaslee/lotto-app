/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileLeaveGuard } from "./MobileLeaveGuard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete document.body.dataset.caishenContactDialogOpen;
  delete document.body.dataset.caishenContactDialogClosing;
});

describe("MobileLeaveGuard", () => {
  it("顯示離站確認，按否後繼續留在網站", () => {
    render(createElement(MobileLeaveGuard, { enabled: true }));
    fireEvent.click(screen.getByRole("button", { name: "離開網站" }));
    expect(screen.getByText("是否離開本網站")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "否" }));
    expect(screen.queryByText("是否離開本網站")).toBeNull();
  });

  it("按是時返回進站前的瀏覽器頁面，不再開啟空白頁", () => {
    window.history.pushState({}, "", "/進站來源");
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    render(createElement(MobileLeaveGuard, { enabled: true }));
    fireEvent.click(screen.getByRole("button", { name: "離開網站" }));
    fireEvent.click(screen.getByRole("button", { name: "是" }));
    expect(go).toHaveBeenCalledWith(-2);
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByText(/空白頁/)).toBeNull();
  });

  it("攔截手機返回與原生關閉事件", () => {
    render(createElement(MobileLeaveGuard, { enabled: true }));
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.getByText("是否離開本網站")).toBeTruthy();
  });

  it("聯絡彈窗開啟或收尾時不誤觸離站確認", () => {
    render(createElement(MobileLeaveGuard, { enabled: true }));

    document.body.dataset.caishenContactDialogOpen = "true";
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.queryByText("是否離開本網站")).toBeNull();

    delete document.body.dataset.caishenContactDialogOpen;
    document.body.dataset.caishenContactDialogClosing = "true";
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.queryByText("是否離開本網站")).toBeNull();
  });
});
