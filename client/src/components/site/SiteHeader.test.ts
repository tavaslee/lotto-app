// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";

afterEach(cleanup);

describe("SiteHeader", () => {
  it("桌機五彩別右側顯示獨立風格聯絡入口並觸發共用彈窗", () => {
    const onOpenContact = vi.fn();
    render(createElement(SiteHeader, {
      selectedLottery: "lotto649",
      onSelectLottery: vi.fn(),
      onHome: vi.fn(),
      session: undefined,
      onOpenMember: vi.fn(),
      onOpenContact,
      compactLayout: false,
    }));

    const navigation = screen.getByRole("navigation", { name: "主選單" });
    for (const label of ["大樂透", "威力彩", "今彩539", "六合彩", "加州天天樂"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(navigation.querySelectorAll("button")).toHaveLength(6);
    const contactButton = screen.getByRole("button", { name: "與我們聯絡" });
    expect(contactButton.className).toContain("bg-emerald-600");
    expect(contactButton.className).toContain("border-emerald-100/70");
    fireEvent.click(contactButton);
    expect(onOpenContact).toHaveBeenCalledTimes(1);
  });

  it("行動版頁首不重複顯示桌機聯絡入口", () => {
    render(createElement(SiteHeader, {
      selectedLottery: "lotto649",
      onSelectLottery: vi.fn(),
      onHome: vi.fn(),
      session: undefined,
      onOpenMember: vi.fn(),
      onOpenContact: vi.fn(),
      compactLayout: true,
    }));

    expect(screen.queryByRole("navigation", { name: "主選單" })).toBeNull();
    expect(screen.queryByRole("button", { name: "與我們聯絡" })).toBeNull();
  });

  it("點擊金元寶財神只觸發專用回首頁操作，不誤觸彩別切換", () => {
    const onHome = vi.fn();
    const onSelectLottery = vi.fn();
    render(createElement(SiteHeader, {
      selectedLottery: "superLotto638",
      onSelectLottery,
      onHome,
      session: undefined,
      onOpenMember: vi.fn(),
      onOpenContact: vi.fn(),
      compactLayout: false,
    }));

    fireEvent.click(screen.getByRole("button", { name: "回到財神首頁" }));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onSelectLottery).not.toHaveBeenCalled();
  });
});
