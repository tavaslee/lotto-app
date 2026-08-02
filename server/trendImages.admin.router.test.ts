import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrendImage } from "../shared/lottery";
import type { TrpcContext } from "./_core/context";

vi.mock("./services/googleSheets", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/googleSheets")>();
  return {
    ...actual,
    deleteTrendImage: vi.fn(),
    listTrendImages: vi.fn(),
    replaceTrendImagesForLottery: vi.fn(),
    upsertTrendImage: vi.fn(),
  };
});

vi.mock("./services/driveMirror", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/driveMirror")>();
  return {
    ...actual,
    applyDriveMirror: vi.fn(),
    previewDriveMirror: vi.fn(),
  };
});

vi.mock("./services/memberAuth", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/memberAuth")>();
  return { ...actual, readMemberSession: vi.fn() };
});

vi.mock("./storage", async importOriginal => {
  const actual = await importOriginal<typeof import("./storage")>();
  return { ...actual, storageErase: vi.fn() };
});

import { appRouter } from "./routers";
import { applyDriveMirror, previewDriveMirror, StaleDriveMirrorPlanError } from "./services/driveMirror";
import { listTrendImages, replaceTrendImagesForLottery } from "./services/googleSheets";
import { readMemberSession } from "./services/memberAuth";
import { storageErase } from "./storage";

const now = new Date("2026-07-23T00:00:00.000Z");
const imageA: TrendImage = {
  id: "image-a",
  lotteryType: "lotto649",
  url: "/manus-storage/trend-images/a.png",
  storageKey: "trend-images/a.png",
  source: "upload",
  caption: "A",
  sortOrder: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};
const imageB: TrendImage = {
  ...imageA,
  id: "image-b",
  url: "https://example.com/b.png",
  storageKey: null,
  source: "external",
  caption: "B",
  sortOrder: 1,
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "local:test",
    name: "測試管理員",
    email: "admin@example.com",
    username: "admin01",
    usernameHash: "hash",
    passwordHash: "hash",
    phone: null,
    notes: null,
    loginMethod: "password",
    activeMemberSessionId: null,
    role: "admin",
    memberLevel: "premium",
    memberStatus: "active",
    membershipExpiresAt: null,
    useCustomPermissions: false,
    customPermissions: null,
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

describe("trend image admin router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readMemberSession).mockResolvedValue(makeUser());
    vi.mocked(listTrendImages).mockResolvedValue([imageA, imageB]);
    vi.mocked(replaceTrendImagesForLottery).mockResolvedValue([imageA, imageB]);
    vi.mocked(storageErase).mockResolvedValue(undefined);
    vi.mocked(previewDriveMirror).mockResolvedValue({
      lotteryType: "lotto649",
      folder: { id: "folder-1", name: "版路1-大樂透" },
      fingerprint: "a".repeat(64),
      additions: [{ id: "drive-new", name: "new.png" }],
      updates: [],
      deletions: [],
      unchangedCount: 0,
      skipped: [],
    });
    vi.mocked(applyDriveMirror).mockResolvedValue({
      folder: { id: "folder-1", name: "版路1-大樂透" },
      added: 1,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      skipped: [],
      cleanupFailures: 0,
    });
  });

  it("batch deletes selected images, preserves unselected rows, and cleans managed storage", async () => {
    await expect(
      appRouter.createCaller(makeContext()).trendImages.deleteMany({
        lotteryType: "lotto649",
        ids: ["image-a"],
      }),
    ).resolves.toEqual({ success: true, deleted: 1, cleanupFailures: 0 });

    expect(replaceTrendImagesForLottery).toHaveBeenCalledWith("lotto649", [imageB]);
    expect(storageErase).toHaveBeenCalledWith("trend-images/a.png");
  });

  it("rejects a stale batch selection before rewriting the sheet", async () => {
    await expect(
      appRouter.createCaller(makeContext()).trendImages.deleteMany({
        lotteryType: "lotto649",
        ids: ["image-a", "missing"],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(replaceTrendImagesForLottery).not.toHaveBeenCalled();
    expect(storageErase).not.toHaveBeenCalled();
  });

  it("persists a complete reordered image list and rejects stale order input", async () => {
    await expect(
      appRouter.createCaller(makeContext()).trendImages.reorder({
        lotteryType: "lotto649",
        ids: ["image-b", "image-a"],
      }),
    ).resolves.toEqual([{ ...imageB, sortOrder: 0 }, { ...imageA, sortOrder: 1 }]);
    expect(replaceTrendImagesForLottery).toHaveBeenCalledWith("lotto649", [
      { ...imageB, sortOrder: 0 },
      { ...imageA, sortOrder: 1 },
    ]);

    await expect(
      appRouter.createCaller(makeContext()).trendImages.reorder({
        lotteryType: "lotto649",
        ids: ["image-a"],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("delegates Drive preview and sync with the selected lottery and fingerprint", async () => {
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.trendImages.drivePreview({ lotteryType: "lotto649" })).resolves.toMatchObject({
      folder: { id: "folder-1", name: "版路1-大樂透" },
      additions: [{ id: "drive-new", name: "new.png" }],
    });
    expect(previewDriveMirror).toHaveBeenCalledWith("lotto649");

    await expect(
      caller.trendImages.driveSync({ lotteryType: "lotto649", fingerprint: "a".repeat(64) }),
    ).resolves.toMatchObject({ added: 1, deleted: 0 });
    expect(applyDriveMirror).toHaveBeenCalledWith("lotto649", "a".repeat(64));
  });

  it("maps an expired Drive preview to conflict and denies non-admin mutations", async () => {
    vi.mocked(applyDriveMirror).mockRejectedValueOnce(new StaleDriveMirrorPlanError());
    await expect(
      appRouter.createCaller(makeContext()).trendImages.driveSync({
        lotteryType: "lotto649",
        fingerprint: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser({ role: "user" }));
    await expect(
      appRouter.createCaller(makeContext()).trendImages.deleteMany({
        lotteryType: "lotto649",
        ids: ["image-a"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(replaceTrendImagesForLottery).not.toHaveBeenCalled();
  });
});
