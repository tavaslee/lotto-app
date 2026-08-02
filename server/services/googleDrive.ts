import { google, type drive_v3 } from "googleapis";
import { LOTTERY_TYPE_BY_TREND_FOLDER_NAME, type LotteryType } from "../../shared/lottery";

const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const DRIVE_TREND_FOLDER_NAMES = Object.fromEntries(
  Object.entries(LOTTERY_TYPE_BY_TREND_FOLDER_NAME).map(([folderName, lotteryType]) => [
    lotteryType,
    folderName,
  ]),
) as Record<LotteryType, string>;

export type DriveImageFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum: string | null;
  size: number;
};

export type DriveSkippedImage = {
  id: string;
  name: string;
  reason: string;
};

export type DriveFolderSnapshot = {
  folder: { id: string; name: string };
  files: DriveImageFile[];
  seenImageFileIds: string[];
  skipped: DriveSkippedImage[];
};

let driveClient: drive_v3.Drive | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`伺服器環境變數 ${name} 尚未設定`);
  return value;
}

function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: [DRIVE_READ_SCOPE],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildDirectChildQuery(folderId: string) {
  return `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`;
}

function explainDriveError(error: unknown): Error {
  const candidate = error as {
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: { error?: { message?: string; status?: string } } };
  };
  const detail = `${candidate.message ?? ""} ${candidate.response?.data?.error?.message ?? ""}`;
  if (detail.includes("drive.googleapis.com") && /disabled|has not been used/i.test(detail)) {
    return new Error(
      "Google Drive API 尚未啟用。請在 Google Cloud 專案 178524727085 啟用 Drive API 後再試。",
    );
  }
  if (candidate.response?.status === 403 || candidate.code === 403 || candidate.code === "403") {
    return new Error("Google Drive 拒絕存取。請確認指定資料夾已分享給網站服務帳號（檢視者即可）。");
  }
  return error instanceof Error ? error : new Error(String(error));
}

async function findFolder(lotteryType: LotteryType) {
  const expectedName = DRIVE_TREND_FOLDER_NAMES[lotteryType];
  try {
    const response = await getDriveClient().files.list({
      q: `name = '${escapeDriveQueryValue(expectedName)}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
      fields: "files(id,name)",
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const folders = (response.data.files ?? []).filter(
      (folder): folder is drive_v3.Schema$File & { id: string; name: string } =>
        Boolean(folder.id && folder.name === expectedName),
    );
    if (!folders.length) {
      throw new Error(
        `找不到「${expectedName}」。請將此資料夾分享給網站服務帳號，並保留完全相同的資料夾名稱。`,
      );
    }
    if (folders.length > 1) {
      throw new Error(`找到多個同名資料夾「${expectedName}」，請只分享一個給網站服務帳號。`);
    }
    return { id: folders[0].id, name: folders[0].name };
  } catch (error) {
    throw explainDriveError(error);
  }
}

export async function listDriveTrendImages(lotteryType: LotteryType): Promise<DriveFolderSnapshot> {
  const folder = await findFolder(lotteryType);
  const allFiles: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  try {
    do {
      const response = await getDriveClient().files.list({
        q: buildDirectChildQuery(folder.id),
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,md5Checksum,size)",
        orderBy: "name_natural",
        pageSize: 1000,
        pageToken,
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      allFiles.push(...(response.data.files ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    throw explainDriveError(error);
  }

  const files: DriveImageFile[] = [];
  const skipped: DriveSkippedImage[] = [];
  const seenImageFileIds: string[] = [];
  for (const file of allFiles) {
    if (!file.id || !file.name || !file.mimeType?.startsWith("image/")) continue;
    seenImageFileIds.push(file.id);
    const size = Number(file.size ?? 0);
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimeType)) {
      skipped.push({ id: file.id, name: file.name, reason: "不支援的圖片格式" });
      continue;
    }
    if (!size || size > MAX_IMAGE_BYTES) {
      skipped.push({ id: file.id, name: file.name, reason: "圖片必須介於 1 byte 與 8 MB" });
      continue;
    }
    files.push({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime ?? "",
      md5Checksum: file.md5Checksum ?? null,
      size,
    });
  }

  return { folder, files, seenImageFileIds, skipped };
}

export async function downloadDriveImage(fileId: string): Promise<Buffer> {
  try {
    const response = await getDriveClient().files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    throw explainDriveError(error);
  }
}
