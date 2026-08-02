import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "../drizzle/schema";
import { PERMISSION_KEYS } from "../shared/lottery";

vi.mock("./db", () => ({
  createLocalUser: vi.fn(),
  getUserByUsername: vi.fn(),
  getUserByUsernameOrEmail: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(async () => undefined),
}));

vi.mock("./services/googleSheets", () => ({
  getGlobalPermissions: vi.fn(async () => ({
    regular: Object.fromEntries(PERMISSION_KEYS.map(key => [key, false])),
    premium: Object.fromEntries(PERMISSION_KEYS.map(key => [key, true])),
  })),
  syncMemberToSheet: vi.fn(),
}));

import { getUserById, getUserByUsernameOrEmail, updateUserById } from "./db";
import { router } from "./_core/trpc";
import { memberProcedure } from "./procedures";
import { memberAuthRouter } from "./routers/memberAuth";
import {
  MEMBER_SESSION_COOKIE,
  createMemberSessionToken,
  hashPassword,
  readMemberSession,
  revokeMemberSession,
} from "./services/memberAuth";

const protectedTestRouter = router({
  memberId: memberProcedure.query(({ ctx }) => ctx.member.id),
});

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 1,
    openId: "local:session-test",
    name: "測試會員",
    email: "member@example.com",
    username: "member01",
    usernameHash: "hash",
    passwordHash: "hash",
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

function requestWithToken(token: string) {
  return {
    headers: { cookie: `${MEMBER_SESSION_COOKIE}=${token}` },
  } as never;
}

function callerFor(token: string) {
  return protectedTestRouter.createCaller({
    req: requestWithToken(token),
    res: {},
    user: null,
  } as never);
}

describe("single-device member sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["regular", "premium"] as const)(
    "replaces the previous %s member device session",
    async memberLevel => {
      const oldSessionId = "a".repeat(64);
      const activeSessionId = "b".repeat(64);
      const user = makeUser({ memberLevel, activeMemberSessionId: activeSessionId });
      vi.mocked(getUserById).mockResolvedValue(user);

      const oldToken = await createMemberSessionToken(user.id, oldSessionId);
      const activeToken = await createMemberSessionToken(user.id, activeSessionId);

      await expect(readMemberSession(requestWithToken(oldToken))).resolves.toBeNull();
      await expect(readMemberSession(requestWithToken(activeToken))).resolves.toMatchObject({
        id: user.id,
        memberLevel,
      });
      await expect(callerFor(oldToken).memberId()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(callerFor(activeToken).memberId()).resolves.toBe(user.id);
    },
  );

  it("keeps administrator sessions compatible with owner and local admin flows", async () => {
    const admin = makeUser({ role: "admin", activeMemberSessionId: null });
    vi.mocked(getUserById).mockResolvedValue(admin);
    const token = await createMemberSessionToken(admin.id);

    await expect(readMemberSession(requestWithToken(token))).resolves.toMatchObject({
      id: admin.id,
      role: "admin",
    });
  });

  it("revokes only the currently active session during logout", async () => {
    const activeSessionId = "c".repeat(64);
    const user = makeUser({ activeMemberSessionId: activeSessionId });
    vi.mocked(getUserById).mockResolvedValue(user);
    const token = await createMemberSessionToken(user.id, activeSessionId);

    await revokeMemberSession(requestWithToken(token));

    expect(updateUserById).toHaveBeenCalledWith(user.id, { activeMemberSessionId: null });
  });

  it("does not let an old device logout revoke the newer device", async () => {
    const user = makeUser({ activeMemberSessionId: "d".repeat(64) });
    vi.mocked(getUserById).mockResolvedValue(user);
    const staleToken = await createMemberSessionToken(user.id, "e".repeat(64));

    await revokeMemberSession(requestWithToken(staleToken));

    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("invalidates the first device after the same premium account logs in on a second device", async () => {
    let storedUser = makeUser({
      memberLevel: "premium",
      passwordHash: await hashPassword("member-password"),
    });
    vi.mocked(getUserByUsernameOrEmail).mockImplementation(async () => storedUser);
    vi.mocked(getUserById).mockImplementation(async () => storedUser);
    vi.mocked(updateUserById).mockImplementation(async (_id, updates) => {
      storedUser = { ...storedUser, ...updates, updatedAt: new Date() };
      return storedUser;
    });

    const firstResponse = { cookie: vi.fn(), clearCookie: vi.fn() };
    const firstDevice = memberAuthRouter.createCaller({
      req: { headers: {} },
      res: firstResponse,
      user: null,
    } as never);
    await firstDevice.login({ identifier: storedUser.username!, password: "member-password" });
    const firstToken = firstResponse.cookie.mock.calls.at(-1)?.[1] as string;

    const secondResponse = { cookie: vi.fn(), clearCookie: vi.fn() };
    const secondDevice = memberAuthRouter.createCaller({
      req: { headers: {} },
      res: secondResponse,
      user: null,
    } as never);
    await secondDevice.login({ identifier: storedUser.username!, password: "member-password" });
    const secondToken = secondResponse.cookie.mock.calls.at(-1)?.[1] as string;

    await expect(readMemberSession(requestWithToken(firstToken))).resolves.toBeNull();
    await expect(readMemberSession(requestWithToken(secondToken))).resolves.toMatchObject({
      id: storedUser.id,
      memberLevel: "premium",
    });
  });
});
