import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarouselSlide, User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createCarouselSlide: vi.fn(),
    deleteCarouselSlide: vi.fn(),
    deleteCarouselSlides: vi.fn(),
    getCarouselSettings: vi.fn(),
    listCarouselSlides: vi.fn(),
    reorderCarouselSlides: vi.fn(),
    saveCarouselSettings: vi.fn(),
    updateCarouselSlide: vi.fn(),
  };
});

vi.mock("./services/memberAuth", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/memberAuth")>();
  return { ...actual, readMemberSession: vi.fn() };
});

vi.mock("./services/carousel", async importOriginal => {
  const actual = await importOriginal<typeof import("./services/carousel")>();
  return { ...actual, uploadCarouselImage: vi.fn() };
});

vi.mock("./storage", async importOriginal => {
  const actual = await importOriginal<typeof import("./storage")>();
  return { ...actual, storageErase: vi.fn() };
});

import {
  createCarouselSlide,
  deleteCarouselSlide,
  deleteCarouselSlides,
  getCarouselSettings,
  listCarouselSlides,
  reorderCarouselSlides,
  saveCarouselSettings,
  updateCarouselSlide,
} from "./db";
import { appRouter } from "./routers";
import { uploadCarouselImage } from "./services/carousel";
import { readMemberSession } from "./services/memberAuth";
import { storageErase } from "./storage";

const settings = { isVisible: true, autoplay: true, intervalMs: 1000 };
const now = new Date("2026-07-20T00:00:00.000Z");
const slide: CarouselSlide = {
  id: 7,
  url: "/manus-storage/carousel-images/banner.png",
  storageKey: "carousel-images/banner.png",
  fileName: "banner.png",
  mimeType: "image/png",
  isActive: true,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
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

describe("carousel router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readMemberSession).mockResolvedValue(makeUser());
    vi.mocked(getCarouselSettings).mockResolvedValue(settings);
    vi.mocked(listCarouselSlides).mockResolvedValue([slide]);
    vi.mocked(createCarouselSlide).mockResolvedValue(slide);
    vi.mocked(updateCarouselSlide).mockResolvedValue(slide);
    vi.mocked(deleteCarouselSlide).mockResolvedValue(slide);
    vi.mocked(deleteCarouselSlides).mockResolvedValue([slide]);
    vi.mocked(reorderCarouselSlides).mockResolvedValue([slide]);
    vi.mocked(saveCarouselSettings).mockImplementation(async input => input);
    vi.mocked(uploadCarouselImage).mockResolvedValue({ key: slide.storageKey, url: slide.url });
    vi.mocked(storageErase).mockResolvedValue(undefined);
  });

  it("hides slides from the public response when display is disabled", async () => {
    vi.mocked(getCarouselSettings).mockResolvedValue({ ...settings, isVisible: false });
    const result = await appRouter.createCaller(makeContext()).carousel.publicView();
    expect(result.slides).toEqual([]);
    expect(listCarouselSlides).not.toHaveBeenCalled();
  });

  it("returns only active slides to the public carousel", async () => {
    const result = await appRouter.createCaller(makeContext()).carousel.publicView();
    expect(result).toEqual({ settings, slides: [slide] });
    expect(listCarouselSlides).toHaveBeenCalledWith(false);
  });

  it("requires an authenticated administrator for management", async () => {
    const caller = appRouter.createCaller(makeContext());
    vi.mocked(readMemberSession).mockResolvedValueOnce(null);
    await expect(caller.carousel.adminView()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser({ role: "user" }));
    await expect(caller.carousel.adminView()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns active and inactive slides to administrators", async () => {
    await expect(appRouter.createCaller(makeContext()).carousel.adminView()).resolves.toEqual({ settings, slides: [slide] });
    expect(listCarouselSlides).toHaveBeenCalledWith(true);
  });

  it("uploads a new slide as inactive and appends its sort order", async () => {
    await appRouter.createCaller(makeContext()).carousel.upload({
      base64Data: "valid-base64",
      fileName: "banner.png",
      mimeType: "image/png",
    });
    expect(uploadCarouselImage).toHaveBeenCalledWith({ base64Data: "valid-base64", fileName: "banner.png", mimeType: "image/png" });
    expect(createCarouselSlide).toHaveBeenCalledWith({
      url: slide.url,
      storageKey: slide.storageKey,
      fileName: "banner.png",
      mimeType: "image/png",
      isActive: false,
      sortOrder: 1,
    });
  });

  it("updates slide availability and reports a missing slide", async () => {
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.carousel.setActive({ id: 7, isActive: false })).resolves.toEqual(slide);
    expect(updateCarouselSlide).toHaveBeenCalledWith(7, { isActive: false });

    vi.mocked(updateCarouselSlide).mockResolvedValueOnce(undefined);
    await expect(caller.carousel.setActive({ id: 99, isActive: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("erases storage bytes and deletes an existing slide record", async () => {
    await expect(appRouter.createCaller(makeContext()).carousel.remove({ id: 7 })).resolves.toEqual({ success: true });
    expect(storageErase).toHaveBeenCalledWith(slide.storageKey);
    expect(deleteCarouselSlide).toHaveBeenCalledWith(7);
  });

  it("does not erase storage when the slide does not exist", async () => {
    vi.mocked(listCarouselSlides).mockResolvedValueOnce([]);
    await expect(appRouter.createCaller(makeContext()).carousel.remove({ id: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageErase).not.toHaveBeenCalled();
    expect(deleteCarouselSlide).not.toHaveBeenCalled();
  });

  it("batch deletes selected slides and reports storage cleanup failures", async () => {
    const second = { ...slide, id: 8, storageKey: "carousel-images/second.png", sortOrder: 1 };
    vi.mocked(listCarouselSlides).mockResolvedValueOnce([slide, second]);
    vi.mocked(deleteCarouselSlides).mockResolvedValueOnce([slide, second]);
    vi.mocked(storageErase)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(appRouter.createCaller(makeContext()).carousel.removeMany({ ids: [7, 8] })).resolves.toEqual({
      success: true,
      deleted: 2,
      cleanupFailures: 1,
    });
    expect(deleteCarouselSlides).toHaveBeenCalledWith([7, 8]);
    expect(storageErase).toHaveBeenCalledWith(slide.storageKey);
    expect(storageErase).toHaveBeenCalledWith(second.storageKey);
  });

  it("rejects a stale batch delete list before deleting records or storage", async () => {
    vi.mocked(listCarouselSlides).mockResolvedValueOnce([slide]);
    await expect(appRouter.createCaller(makeContext()).carousel.removeMany({ ids: [7, 8] })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(deleteCarouselSlides).not.toHaveBeenCalled();
    expect(storageErase).not.toHaveBeenCalled();
  });

  it("persists the full carousel order and rejects non-admin callers", async () => {
    const second = { ...slide, id: 8, storageKey: "carousel-images/second.png", sortOrder: 1 };
    vi.mocked(reorderCarouselSlides).mockResolvedValueOnce([second, slide]);
    await expect(appRouter.createCaller(makeContext()).carousel.reorder({ ids: [8, 7] })).resolves.toEqual([
      second,
      slide,
    ]);
    expect(reorderCarouselSlides).toHaveBeenCalledWith([8, 7]);

    vi.mocked(readMemberSession).mockResolvedValueOnce(makeUser({ role: "user" }));
    await expect(appRouter.createCaller(makeContext()).carousel.removeMany({ ids: [7] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(deleteCarouselSlides).not.toHaveBeenCalled();
  });

  it("stores a valid 0.5-second interval as milliseconds", async () => {
    await expect(appRouter.createCaller(makeContext()).carousel.updateSettings({
      isVisible: true,
      autoplay: false,
      intervalSeconds: 1.5,
    })).resolves.toEqual({ isVisible: true, autoplay: false, intervalMs: 1500 });
    expect(saveCarouselSettings).toHaveBeenCalledWith({ isVisible: true, autoplay: false, intervalMs: 1500 });
  });

  it.each([0.4, 0.6, 10.5])("rejects an invalid %s-second interval", async intervalSeconds => {
    await expect(appRouter.createCaller(makeContext()).carousel.updateSettings({
      isVisible: true,
      autoplay: true,
      intervalSeconds,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveCarouselSettings).not.toHaveBeenCalled();
  });
});
