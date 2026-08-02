import { describe, expect, it } from "vitest";
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach } from "vitest";
import { CalculatorPanel, getValidBallCount } from "./CalculatorPanel";

afterEach(cleanup);

describe("連碰計算器球數輸入", () => {
  it("允許空白，且只接受 2 到 49 的整數", () => {
    expect(getValidBallCount("")).toBe(0);
    expect(getValidBallCount("2")).toBe(2);
    expect(getValidBallCount("49")).toBe(49);
    expect(getValidBallCount("1")).toBe(0);
    expect(getValidBallCount("50")).toBe(0);
    expect(getValidBallCount("2.5")).toBe(0);
  });
});

describe("連碰立柱合併頁", () => {
  it("同一頁同時呈現連碰計算器與立柱計算器", () => {
    render(createElement(CalculatorPanel, { initialMode: "combination", combined: true }));
    expect(screen.getByRole("heading", { name: "連碰計算器" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "立柱計算器" })).toBeTruthy();
  });
});
