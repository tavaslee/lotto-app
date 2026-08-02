import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./services/memberAuth", async importOriginal => ({ ...(await importOriginal<typeof import("./services/memberAuth")>()), readMemberSession: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), recordSiteVisit: vi.fn(), getSiteAnalytics: vi.fn() }));

import { appRouter } from "./routers";
import { getSiteAnalytics, recordSiteVisit } from "./db";
import { readMemberSession } from "./services/memberAuth";

const makeUser = (role: "user" | "admin"): User => {
  const now = new Date();
  return { id: 1, openId: "local:analytics", name: "測試", email: null, username: "tester", usernameHash: "hash", passwordHash: "hash", phone: null, notes: null, loginMethod: "password", activeMemberSessionId: null, role, memberLevel: "premium", memberStatus: "active", membershipExpiresAt: null, useCustomPermissions: false, customPermissions: null, allowedLotteryTypes: null, memberSyncStatus: "synced", memberSyncedAt: now, memberSyncError: null, createdAt: now, updatedAt: now, lastSignedIn: now };
};
const context = (): TrpcContext => ({ user: null, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] });

describe("analytics router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a validated anonymous visit payload", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.analytics.record({ visitorId: "visitor-123", path: "/", referrerHost: null, device: "mobile" })).resolves.toEqual({ success: true });
    expect(recordSiteVisit).toHaveBeenCalledWith({ visitorId: "visitor-123", path: "/", referrerHost: null, device: "mobile" });
  });

  it("allows only administrators to read aggregated traffic", async () => {
    const caller = appRouter.createCaller(context());
    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser("user"));
    await expect(caller.analytics.overview({ days: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser("admin"));
    vi.mocked(getSiteAnalytics).mockResolvedValueOnce({ days: 30 } as Awaited<ReturnType<typeof getSiteAnalytics>>);
    await expect(caller.analytics.overview({ days: 30 })).resolves.toEqual({ days: 30 });
    expect(getSiteAnalytics).toHaveBeenCalledWith(30);
  });
});
