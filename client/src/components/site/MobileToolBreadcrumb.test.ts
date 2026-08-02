/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileToolBreadcrumb } from "./MobileToolBreadcrumb";

afterEach(cleanup);

describe("MobileToolBreadcrumb", () => {
  it("顯示回首頁、走勢分析與目前工具並可返回首頁", () => {
    const onHome = vi.fn();
    render(createElement(MobileToolBreadcrumb, {
      activeView: "analysis",
      activeAnalysis: "missingNumbers",
      onHome,
    }));

    expect(screen.getByText("走勢分析")).toBeTruthy();
    expect(screen.getByText("距今未開")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "回首頁" }));
    expect(onHome).toHaveBeenCalledOnce();
  });
});
