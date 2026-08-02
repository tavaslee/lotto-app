import { createHash } from "node:crypto";
import type { LotteryType, TrendImage } from "../../shared/lottery";
import { storageErase, storagePut } from "../storage";
import {
  downloadDriveImage,
  listDriveTrendImages,
  type DriveFolderSnapshot,
  type DriveImageFile,
} from "./googleDrive";
import { listTrendImages, replaceTrendImagesForLottery } from "./googleSheets";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type DriveMirrorPlan = {
  lotteryType: LotteryType;
  folder: { id: string; name: string };
  fingerprint: string;
  additions: DriveImageFile[];
  updates: Array<{ current: TrendImage; drive: DriveImageFile }>;
  deletions: TrendImage[];
  unchangedCount: number;
  skipped: DriveFolderSnapshot["skipped"];
};

export class StaleDriveMirrorPlanError extends Error {
  constructor() {
    super("Google Drive 或後台圖片已在預覽後變更，請重新檢查再同步。");
  }
}

const stableFingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildDriveMirrorPlan(
  lotteryType: LotteryType,
  currentImages: TrendImage[],
  snapshot: DriveFolderSnapshot,
): DriveMirrorPlan {
  const byDriveId = new Map(
    currentImages.filter(image => image.driveFileId).map(image => [image.driveFileId as string, image]),
  );
  const additions: DriveImageFile[] = [];
  const updates: Array<{ current: TrendImage; drive: DriveImageFile }> = [];
  let unchangedCount = 0;

  for (const driveFile of snapshot.files) {
    const current = byDriveId.get(driveFile.id);
    if (!current) {
      additions.push(driveFile);
      continue;
    }
    const changed =
      current.driveModifiedTime !== driveFile.modifiedTime ||
      current.driveMd5Checksum !== driveFile.md5Checksum ||
      current.driveFileName !== driveFile.name ||
      current.driveMimeType !== driveFile.mimeType ||
      current.driveFolderId !== snapshot.folder.id;
    if (changed) updates.push({ current, drive: driveFile });
    else unchangedCount += 1;
  }

  const seenIds = new Set(snapshot.seenImageFileIds);
  const deletions = currentImages.filter(image => !image.driveFileId || !seenIds.has(image.driveFileId));
  const fingerprint = stableFingerprint({
    folder: snapshot.folder,
    drive: [
      ...snapshot.files.map(file => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        md5Checksum: file.md5Checksum,
        size: file.size,
      })),
      ...snapshot.skipped.map(file => ({ ...file, skipped: true })),
    ].sort((a, b) => a.id.localeCompare(b.id)),
    current: currentImages
      .map(image => ({
        id: image.id,
        source: image.source,
        sortOrder: image.sortOrder,
        updatedAt: image.updatedAt,
        driveFileId: image.driveFileId,
        driveModifiedTime: image.driveModifiedTime,
        driveMd5Checksum: image.driveMd5Checksum,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

  return {
    lotteryType,
    folder: snapshot.folder,
    fingerprint,
    additions,
    updates,
    deletions,
    unchangedCount,
    skipped: snapshot.skipped,
  };
}

async function currentPlan(lotteryType: LotteryType) {
  const [currentImages, snapshot] = await Promise.all([
    listTrendImages(lotteryType),
    listDriveTrendImages(lotteryType),
  ]);
  return { currentImages, plan: buildDriveMirrorPlan(lotteryType, currentImages, snapshot) };
}

export async function previewDriveMirror(lotteryType: LotteryType) {
  const { plan } = await currentPlan(lotteryType);
  return {
    lotteryType,
    folder: plan.folder,
    fingerprint: plan.fingerprint,
    additions: plan.additions.map(file => ({ id: file.id, name: file.name })),
    updates: plan.updates.map(item => ({ id: item.drive.id, name: item.drive.name })),
    deletions: plan.deletions.map(image => ({ id: image.id, name: image.driveFileName || image.caption })),
    unchangedCount: plan.unchangedCount,
    skipped: plan.skipped,
  };
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "drive-image";
}

function captionFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, "").slice(0, 120);
}

export async function applyDriveMirror(lotteryType: LotteryType, expectedFingerprint: string) {
  const { currentImages, plan } = await currentPlan(lotteryType);
  if (plan.fingerprint !== expectedFingerprint) throw new StaleDriveMirrorPlanError();

  const now = new Date().toISOString();
  const uploadedKeys: string[] = [];
  const oldKeysToErase = new Set<string>();
  let nextImages = currentImages.filter(
    image => !plan.deletions.some(deleted => deleted.id === image.id),
  );

  for (const image of plan.deletions) {
    if (image.storageKey) oldKeysToErase.add(image.storageKey);
  }

  try {
    for (const { current, drive } of plan.updates) {
      const bytes = await downloadDriveImage(drive.id);
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
        throw new Error(`${drive.name} 大小必須介於 1 byte 與 8 MB`);
      }
      const stored = await storagePut(
        `trend-images/${lotteryType}/google-drive/${drive.id}-${safeFileName(drive.name)}`,
        bytes,
        drive.mimeType,
      );
      uploadedKeys.push(stored.key);
      if (current.storageKey) oldKeysToErase.add(current.storageKey);
      nextImages = nextImages.map(image =>
        image.id === current.id
          ? {
              ...current,
              url: stored.url,
              storageKey: stored.key,
              caption: captionFromFileName(drive.name),
              updatedAt: now,
              driveFileId: drive.id,
              driveFolderId: plan.folder.id,
              driveFileName: drive.name,
              driveMimeType: drive.mimeType,
              driveModifiedTime: drive.modifiedTime,
              driveMd5Checksum: drive.md5Checksum,
            }
          : image,
      );
    }

    let nextSortOrder = nextImages.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;
    for (const drive of plan.additions) {
      const bytes = await downloadDriveImage(drive.id);
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
        throw new Error(`${drive.name} 大小必須介於 1 byte 與 8 MB`);
      }
      const stored = await storagePut(
        `trend-images/${lotteryType}/google-drive/${drive.id}-${safeFileName(drive.name)}`,
        bytes,
        drive.mimeType,
      );
      uploadedKeys.push(stored.key);
      nextImages.push({
        id: crypto.randomUUID(),
        lotteryType,
        url: stored.url,
        storageKey: stored.key,
        source: "google-drive",
        caption: captionFromFileName(drive.name),
        sortOrder: nextSortOrder++,
        createdAt: now,
        updatedAt: now,
        driveFileId: drive.id,
        driveFolderId: plan.folder.id,
        driveFileName: drive.name,
        driveMimeType: drive.mimeType,
        driveModifiedTime: drive.modifiedTime,
        driveMd5Checksum: drive.md5Checksum,
      });
    }

    await replaceTrendImagesForLottery(lotteryType, nextImages);
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map(key => storageErase(key)));
    throw error;
  }

  const cleanup = await Promise.allSettled(Array.from(oldKeysToErase).map(key => storageErase(key)));
  return {
    folder: plan.folder,
    added: plan.additions.length,
    updated: plan.updates.length,
    deleted: plan.deletions.length,
    unchanged: plan.unchangedCount,
    skipped: plan.skipped,
    cleanupFailures: cleanup.filter(result => result.status === "rejected").length,
  };
}
