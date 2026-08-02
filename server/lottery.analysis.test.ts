import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import { DEFAULT_PERMISSIONS, LEGACY_PERMISSION_KEYS, PERMISSION_KEYS, type DrawRecord } from "../shared/lottery";
import type { TrpcContext } from "./_core/context";

vi.mock("./services/memberAuth", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/memberAuth")>();
  return { ...actual, readMemberSession: vi.fn(), resolveEffectivePermissions: vi.fn() };
});

vi.mock("./services/googleSheets", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/googleSheets")>();
  return { ...actual, listDraws: vi.fn(async () => []) };
});

import { appRouter } from "./routers";
import { listDraws } from "./services/googleSheets";
import { readMemberSession, resolveEffectivePermissions } from "./services/memberAuth";

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 1,
    openId: "local:analysis",
    name: "分析會員",
    email: "analysis@example.com",
    username: "analysis01",
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
  return { user: null, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function draw(index: number, lotteryType: DrawRecord["lotteryType"] = "lotto649"): DrawRecord {
  const issue = String(index).padStart(3, "0");
  return {
    id: `${lotteryType}:${issue}`,
    lotteryType,
    issue,
    drawDateRoc: "115.01.01",
    drawDateIso: "2026-01-01",
    numbers: ["01", "02", "03", "04", "05", "06"],
    specialNumber: "07",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const dateInput = {
  lotteryType: "lotto649" as const,
  tool: "distributionChart" as const,
  includeSpecial: true,
  rangeMode: "date" as const,
  fromDate: "2026-01-01",
  toDate: "2026-01-31",
};

describe("lottery analysis API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveEffectivePermissions).mockResolvedValue({ ...DEFAULT_PERMISSIONS.regular });
  });

  it.each([
    ["regular", "user", 30],
    ["premium", "user", 100],
    ["regular", "admin", 120],
  ] as const)("enforces the %s/%s analysis limit", async (memberLevel, role, expected) => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser({ memberLevel, role }));
    vi.mocked(listDraws).mockResolvedValue(Array.from({ length: 120 }, (_, index) => draw(120 - index)));
    const result = await appRouter.createCaller(makeContext()).lottery.analysis(dateInput);
    expect(result.records).toHaveLength(expected);
    expect(result.roleLimit).toBe(role === "admin" ? null : expected);
  });

  it("accepts an issue range in either direction and returns records from old to new", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser());
    vi.mocked(listDraws).mockResolvedValue([draw(3), draw(2), draw(1)]);
    const result = await appRouter.createCaller(makeContext()).lottery.analysis({
      lotteryType: "lotto649",
      tool: "distributionChart",
      includeSpecial: false,
      rangeMode: "issue",
      fromIssue: "003",
      toIssue: "001",
    });
    expect(result.records.map(record => record.issue)).toEqual(["001", "002", "003"]);
  });

  it("accepts a recent-count query, returns the requested latest records from old to new, and keeps the role limit", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser());
    vi.mocked(listDraws).mockResolvedValue(Array.from({ length: 40 }, (_, index) => draw(40 - index)));
    const result = await appRouter.createCaller(makeContext()).lottery.analysis({
      lotteryType: "lotto649",
      tool: "distributionChart",
      includeSpecial: false,
      rangeMode: "count",
      count: 35,
    });
    expect(result.records).toHaveLength(30);
    expect(result.records[0]?.issue).toBe("011");
    expect(result.records.at(-1)?.issue).toBe("040");
    expect(result.totalMatched).toBe(35);
    expect(result.truncated).toBe(true);
  });

  it("blocks a disabled analysis tool", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser());
    vi.mocked(resolveEffectivePermissions).mockResolvedValue({ ...DEFAULT_PERMISSIONS.regular, distributionChart: false });
    await expect(appRouter.createCaller(makeContext()).lottery.analysis(dateInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows special numbers only for lotto649 and markSix, never for superLotto638", async () => {
    vi.mocked(readMemberSession).mockResolvedValue(makeUser());
    vi.mocked(listDraws).mockResolvedValue([draw(1)]);
    const lotto = await appRouter.createCaller(makeContext()).lottery.analysis(dateInput);
    vi.mocked(listDraws).mockResolvedValue([draw(1, "superLotto638")]);
    const superLotto = await appRouter.createCaller(makeContext()).lottery.analysis({ ...dateInput, lotteryType: "superLotto638" });
    expect(lotto.includeSpecial).toBe(true);
    expect(superLotto.includeSpecial).toBe(false);
  });

  it("keeps removed tools only in the legacy sheet order, not the current permission API", () => {
    expect(LEGACY_PERMISSION_KEYS).toEqual(expect.arrayContaining(["statisticsTable", "sumAnalysis", "repeatedDraws", "tailNumbers"]));
    expect(PERMISSION_KEYS).not.toEqual(expect.arrayContaining(["statisticsTable", "sumAnalysis", "repeatedDraws", "tailNumbers"]));
  });
});
