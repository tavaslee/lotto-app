// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactDialog, LINE_OFFICIAL_URL, LINE_QR_URL } from "./ContactDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", window.location.href);
  delete document.body.dataset.caishenContactDialogOpen;
  delete document.body.dataset.caishenContactDialogClosing;
});

describe("ContactDialog", () => {
  it("桌機與手機共用相同 LINE QR 內容", () => {
    render(createElement(ContactDialog, { open: true, onOpenChange: vi.fn() }));

    expect(screen.getByRole("heading", { name: "與我們聯絡" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "前往財神 LINE 官方帳號" }).getAttribute("href")).toBe(LINE_OFFICIAL_URL);
    expect(screen.getByAltText("財神 LINE 官方帳號 QR 碼").getAttribute("src")).toBe(LINE_QR_URL);
  });

  it("開啟時加入歷史標記，瀏覽器倒退時關閉並清除開啟旗標", () => {
    const onOpenChange = vi.fn();
    const pushState = vi.spyOn(window.history, "pushState");
    render(createElement(ContactDialog, { open: true, onOpenChange }));

    expect(pushState).toHaveBeenCalled();
    expect(window.history.state?.__caishenContactDialog).toBe(true);
    expect(document.body.dataset.caishenContactDialogOpen).toBe("true");

    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
