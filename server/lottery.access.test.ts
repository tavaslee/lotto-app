import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./services/memberAuth", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/memberAuth")>();
  return { ...actual, readMemberSession: vi.fn() };
});

vi.mock("./services/googleSheets", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/googleSheets")>();
  return {
    ...actual,
    listDraws: vi.fn(async () => []),
    listMemberUsers: vi.fn(async () => []),
    getSiteSettings: vi.fn(async () => ({ trendAnalysisVisible: true })),
    setSiteSettings: vi.fn(async () => undefined),
  };
});

import { appRouter } from "./routers";
import { readMemberSession } from "./services/memberAuth";
import { getSiteSettings, listDraws, setSiteSettings } from "./services/googleSheets";

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 1,
    openId: "local:test",
    name: "測試會員",
    email: "member@example.com",
    username: "member01",
    usernameHash: "hash",
    passwordHash: "hash",
    phone: null,
    notes: null,
    loginMethod: "password",
    role: "user",
    memberLevel: "regular",
    memberStatus: "active",
    membershipExpiresAt: null,
    useCustomPermissions: false,
    customPermissions: null,
    allowedLotteryTypes: null,
    memberSyncStatus: "synced",
    memberSyncedAt: now,
    memberSyncError: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    ...overrides,
  };
}

function makeContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("lottery member access rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caps regular member history at 10 records", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser({ memberLevel: "regular" }));
    const caller = appRouter.createCaller(makeContext());
    await caller.lottery.history({ lotteryType: "lotto649", limit: 100 });
    expect(listDraws).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it("allows premium members to request the selected history limit", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser({ memberLevel: "premium" }));
    const caller = appRouter.createCaller(makeContext());
    await caller.lottery.history({ lotteryType: "lotto649", limit: 100 });
    expect(listDraws).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it("blocks an unselected lottery from latest, history, and trend-image member APIs", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser({ memberLevel: "premium", allowedLotteryTypes: ["lotto649"] }));
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.lottery.latest({ lotteryType: "daily539" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.lottery.history({ lotteryType: "daily539", limit: 50 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.trendImages.list({ lotteryType: "daily539" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("omits unselected lotteries from the home latest board at the server", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser({ memberLevel: "premium", allowedLotteryTypes: ["lotto649"] }));
    const caller = appRouter.createCaller(makeContext());
    await caller.lottery.latestAll();
    expect(listDraws).toHaveBeenCalledTimes(1);
    expect(listDraws).toHaveBeenCalledWith({ lotteryType: "lotto649", limit: 1 });
  });

  it("rejects a non-admin member from administrator member APIs", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser({ role: "user" }));
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.adminMembers.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows public visitors to read site display settings", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(null);
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.permissions.siteSettings()).resolves.toEqual({ trendAnalysisVisible: true });
    expect(getSiteSettings).toHaveBeenCalledOnce();
  });

  it("allows only administrators to update site display settings", async () => {
    const caller = appRouter.createCaller(makeContext());
    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser({ role: "user" }));
    await expect(caller.permissions.updateSiteSettings({ trendAnalysisVisible: false })).rejects.toMatchObject({ code: "FORBIDDEN" });

    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser({ role: "admin" }));
    await expect(caller.permissions.updateSiteSettings({ trendAnalysisVisible: false })).resolves.toEqual({ success: true });
    expect(setSiteSettings).toHaveBeenCalledWith({ trendAnalysisVisible: false });
  });
});
