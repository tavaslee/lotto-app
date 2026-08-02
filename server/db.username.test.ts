import { describe, expect, it } from "vitest";
import { usernameLookupHash } from "./db";

describe("username lookup hash", () => {
  it("creates a deterministic fixed-length lookup key for long usernames", () => {
    const username = "會員帳號".repeat(10_000);
    expect(usernameLookupHash(username)).toHaveLength(64);
    expect(usernameLookupHash(username)).toBe(usernameLookupHash(username));
    expect(usernameLookupHash(`${username}不同`)).not.toBe(usernameLookupHash(username));
  });
});
