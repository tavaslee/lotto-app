import type { LotteryType, TrendImage } from "../../shared/lottery";
import type { DriveFolderSnapshot, DriveImageFile } from "./googleDrive";
import { buildDriveMirrorPlan } from "./driveMirror";
import { describe, expect, it } from "vitest";

const lotteryType: LotteryType = "lotto649";

function driveFile(id: string, overrides: Partial<DriveImageFile> = {}): DriveImageFile {
  return {
    id,
    name: `${id}.png`,
    mimeType: "image/png",
    modifiedTime: "2026-07-23T00:00:00.000Z",
    md5Checksum: `md5-${id}`,
    size: 1024,
    ...overrides,
  };
}

function trendImage(id: string, overrides: Partial<TrendImage> = {}): TrendImage {
  return {
    id,
    lotteryType,
    url: `https://example.com/${id}.png`,
    storageKey: `trend-images/${id}.png`,
    source: "google-drive",
    caption: id,
    sortOrder: 0,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    driveFileId: id,
    driveFolderId: "folder-1",
    driveFileName: `${id}.png`,
    driveMimeType: "image/png",
    driveModifiedTime: "2026-07-23T00:00:00.000Z",
    driveMd5Checksum: `md5-${id}`,
    ...overrides,
  };
}

function snapshot(files: DriveImageFile[], overrides: Partial<DriveFolderSnapshot> = {}): DriveFolderSnapshot {
  return {
    folder: { id: "folder-1", name: "版路1-大樂透" },
    files,
    seenImageFileIds: files.map(file => file.id),
    skipped: [],
    ...overrides,
  };
}

describe("Drive mirror plan", () => {
  it("classifies additions, updates, deletions and unchanged images with Drive as the only source", () => {
    const unchanged = trendImage("unchanged", { sortOrder: 1 });
    const updated = trendImage("updated", { sortOrder: 2, driveModifiedTime: "2026-07-20T00:00:00.000Z" });
    const deleted = trendImage("deleted", { sortOrder: 3 });
    const manual = trendImage("manual", {
      source: "upload",
      driveFileId: null,
      driveFolderId: null,
      driveFileName: null,
      driveMimeType: null,
      driveModifiedTime: null,
      driveMd5Checksum: null,
    });
    const plan = buildDriveMirrorPlan(
      lotteryType,
      [manual, unchanged, updated, deleted],
      snapshot([driveFile("unchanged"), driveFile("updated"), driveFile("added")]),
    );

    expect(plan.additions.map(file => file.id)).toEqual(["added"]);
    expect(plan.updates.map(item => item.current.id)).toEqual(["updated"]);
    expect(plan.deletions.map(image => image.id)).toEqual(["manual", "deleted"]);
    expect(plan.unchangedCount).toBe(1);
    expect(plan.deletions).toContainEqual(expect.objectContaining({ id: "manual", source: "upload" }));
  });

  it("does not delete a previously mirrored image when the Drive file is skipped for size", () => {
    const skipped = { id: "large", name: "large.png", reason: "檔案超過 8 MB" };
    const plan = buildDriveMirrorPlan(
      lotteryType,
      [trendImage("large")],
      snapshot([], { seenImageFileIds: ["large"], skipped: [skipped] }),
    );

    expect(plan.deletions).toEqual([]);
    expect(plan.skipped).toEqual([skipped]);
  });

  it("keeps the preview fingerprint stable when Google returns files in a different order", () => {
    const current = [trendImage("a"), trendImage("b")];
    const first = buildDriveMirrorPlan(lotteryType, current, snapshot([driveFile("a"), driveFile("b")]));
    const second = buildDriveMirrorPlan(lotteryType, current, snapshot([driveFile("b"), driveFile("a")]));

    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("changes the preview fingerprint when Drive content changes after confirmation", () => {
    const current = [trendImage("a")];
    const first = buildDriveMirrorPlan(lotteryType, current, snapshot([driveFile("a")]));
    const second = buildDriveMirrorPlan(
      lotteryType,
      current,
      snapshot([driveFile("a", { modifiedTime: "2026-07-24T00:00:00.000Z", md5Checksum: "new-md5" })]),
    );

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});
