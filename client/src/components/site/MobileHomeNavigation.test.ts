// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileHomeNavigation } from "./MobileHomeNavigation";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", window.location.href);
  delete document.body.dataset.caishenContactDialogOpen;
  delete document.body.dataset.caishenContactDialogClosing;
});

describe("MobileHomeNavigation", () => {
  it("顯示五彩別與聯絡入口，並在彈窗提供可點擊的 LINE QR", () => {
    render(createElement(MobileHomeNavigation, { selectedLottery: "lotto649", session: undefined, onSelectLottery: vi.fn() }));
    for (const label of ["大樂透", "威力彩", "今彩539", "六合彩", "加州天天樂", "與我們聯絡"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "與我們聯絡" }));
    const lineLink = screen.getByRole("link", { name: "前往財神 LINE 官方帳號" });
    expect(lineLink.getAttribute("href")).toBe("https://lin.ee/qH2pGrv");
    expect(screen.getByAltText("財神 LINE 官方帳號 QR 碼")).toBeTruthy();
  });

  it("聯絡彈窗可由瀏覽器倒退鍵關閉", () => {
    render(createElement(MobileHomeNavigation, { selectedLottery: "lotto649", session: undefined, onSelectLottery: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "與我們聯絡" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
