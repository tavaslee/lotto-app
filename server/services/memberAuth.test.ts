import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";
import { PERMISSION_KEYS } from "../../shared/lottery";

vi.mock("./googleSheets", () => ({
  getGlobalPermissions: vi.fn(async () => ({
    regular: Object.fromEntries(PERMISSION_KEYS.map(key => [key, false])),
    premium: Object.fromEntries(PERMISSION_KEYS.map(key => [key, true])),
  })),
  syncMemberToSheet: vi.fn(),
}));

vi.mock("../db", () => ({
  getUserById: vi.fn(),
  updateUserById: vi.fn(async () => undefined),
}));

import { updateUserById } from "../db";
import { syncMemberToSheet } from "./googleSheets";
import {
  buildMemberSyncUpdate,
  hashPassword,
  resolveEffectivePermissions,
  syncMemberSafely,
  verifyPassword,
} from "./memberAuth";

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 1,
    openId: "local:test",
    name: "測試會員",
    email: "member@example.com",
    username: "member01",
    usernameHash: "hash",
    passwordHash: null,
    phone: null,
    notes: null,
    loginMethod: "password",
    activeMemberSessionId: null,
    role: "user",
    memberLevel: "regular",
    memberStatus: "active",
    membershipExpiresAt: null,
    useCustomPermissions: false,
    customPermissions: null,
    memberSyncStatus: "pending",
    memberSyncedAt: null,
    memberSyncError: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    ...overrides,
  };
}

describe("member password, permissions and sheet backup state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes passwords without retaining plaintext and verifies the correct password", async () => {
    const hash = await hashPassword("SecurePass123");
    expect(hash).not.toContain("SecurePass123");
    await expect(verifyPassword("SecurePass123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("supports one-character and very long passwords without truncating them", async () => {
    const shortHash = await hashPassword("1");
    await expect(verifyPassword("1", shortHash)).resolves.toBe(true);

    const longPassword = "無限制密碼".repeat(2_000);
    const longHash = await hashPassword(longPassword);
    await expect(verifyPassword(longPassword, longHash)).resolves.toBe(true);
    await expect(verifyPassword(`${longPassword}不同`, longHash)).resolves.toBe(false);
  });

  it("continues to verify legacy bcrypt password hashes", async () => {
    const legacyHash = await bcrypt.hash("legacy-password", 4);
    await expect(verifyPassword("legacy-password", legacyHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", legacyHash)).resolves.toBe(false);
  });

  it("merges individual overrides onto the member level permissions", async () => {
    const permissions = await resolveEffectivePermissions(
      makeUser({
        useCustomPermissions: true,
        customPermissions: { trendBoard: true, oddEvenRatio: true },
      }),
    );
    expect(permissions.trendBoard).toBe(true);
    expect(permissions.oddEvenRatio).toBe(true);
    expect(permissions.distributionChart).toBe(false);
  });

  it("grants administrators all 12 feature permissions", async () => {
    const permissions = await resolveEffectivePermissions(makeUser({ role: "admin" }));
    expect(PERMISSION_KEYS.every(key => permissions[key])).toBe(true);
  });

  it("records pending then synced when Google Sheets backup succeeds", async () => {
    vi.mocked(syncMemberToSheet).mockResolvedValueOnce(undefined);
    await expect(syncMemberSafely(makeUser())).resolves.toBeNull();

    expect(updateUserById).toHaveBeenNthCalledWith(1, 1, {
      memberSyncStatus: "pending",
      memberSyncError: null,
    });
    expect(updateUserById).toHaveBeenNthCalledWith(
      2,
      1,
      expect.objectContaining({
        memberSyncStatus: "synced",
        memberSyncedAt: expect.any(Date),
        memberSyncError: null,
      }),
    );
  });

  it("records failed and a bounded error when Google Sheets backup is unavailable", async () => {
    vi.mocked(syncMemberToSheet).mockRejectedValueOnce(new Error("Sheets API temporarily unavailable"));
    await expect(syncMemberSafely(makeUser())).resolves.toContain("暫時失敗");

    expect(updateUserById).toHaveBeenNthCalledWith(1, 1, buildMemberSyncUpdate("pending"));
    expect(updateUserById).toHaveBeenNthCalledWith(2, 1, {
      memberSyncStatus: "failed",
      memberSyncError: "Sheets API temporarily unavailable",
    });
  });
});
