import { describe, expect, it } from "vitest";
import { memberRegistrationSchema } from "./memberAuth";

describe("member registration input", () => {
  it("requires only username and password and accepts one-character values", () => {
    expect(memberRegistrationSchema.parse({ username: "A", password: "1" })).toEqual({
      username: "a",
      password: "1",
    });
  });

  it("accepts long values without application-level maximum length", () => {
    const username = "帳".repeat(10_000);
    const password = "密".repeat(10_000);
    expect(memberRegistrationSchema.parse({ username, password })).toEqual({ username, password });
  });

  it("still rejects blank required fields", () => {
    expect(memberRegistrationSchema.safeParse({ username: "", password: "1" }).success).toBe(false);
    expect(memberRegistrationSchema.safeParse({ username: "member", password: "" }).success).toBe(false);
  });
});
