import { describe, expect, it } from "vitest";
import { nextRegisterModeOnDialogChange } from "./memberDialogMode";

describe("會員對話框重新開啟模式", () => {
  it("匿名使用者以登入模式開啟時會清除先前殘留的註冊模式", () => {
    expect(nextRegisterModeOnDialogChange({
      open: true,
      hasMemberSession: false,
      initialMode: "login",
      currentMode: true,
    })).toBe(false);
  });

  it("明確要求註冊模式時會切換到註冊表單", () => {
    expect(nextRegisterModeOnDialogChange({
      open: true,
      hasMemberSession: false,
      initialMode: "register",
      currentMode: false,
    })).toBe(true);
  });

  it("對話框關閉或已有會員工作階段時保留目前模式", () => {
    expect(nextRegisterModeOnDialogChange({
      open: false,
      hasMemberSession: false,
      initialMode: "login",
      currentMode: true,
    })).toBe(true);
    expect(nextRegisterModeOnDialogChange({
      open: true,
      hasMemberSession: true,
      initialMode: "login",
      currentMode: true,
    })).toBe(true);
  });
});
