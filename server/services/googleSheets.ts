import { google, type sheets_v4 } from "googleapis";
import {
  DEFAULT_PERMISSIONS,
  LEGACY_PERMISSION_KEYS,
  LOTTERY_CONFIG,
  LOTTERY_TYPE_BY_NAME,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type DrawRecord,
  type LotteryType,
  type MemberLevel,
  type PermissionSet,
  type SheetMember,
  type TrendImage,
  padBallNumber,
} from "../../shared/lottery";
import { rocDateToIso } from "../utils/lottery";
import { createTtlReadCache } from "./ttlReadCache";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DRAW_SHEET = "開獎資料";
const IMAGE_SHEET = "版路圖片";
const MEMBER_SHEET = "會員資料";
const PERMISSION_SHEET = "權限設定";
const SYSTEM_SETTINGS_SHEET = "系統設定";

const DRAW_HEADERS = [
  "彩別",
  "期數",
  "開獎日期（民國）",
  "號碼1",
  "號碼2",
  "號碼3",
  "號碼4",
  "號碼5",
  "號碼6",
  "特別號",
  "建立時間",
  "更新時間",
  "資料狀態",
];

const IMAGE_HEADERS = [
  "圖片ID",
  "彩別",
  "圖片URL",
  "S3 Key",
  "來源",
  "說明",
  "排序",
  "建立時間",
  "更新時間",
  "資料狀態",
  "Drive File ID",
  "Drive 資料夾 ID",
  "Drive 檔名",
  "Drive MIME",
  "Drive 修改時間",
  "Drive MD5",
];

const MEMBER_HEADERS = [
  "會員ID",
  "帳號",
  "姓名",
  "電子郵件",
  "手機",
  "會員等級",
  "會員狀態",
  "加入日期",
  "到期日期",
  "最後登入時間",
  "啟用個別權限",
  "個別權限JSON",
  "備註",
  "建立時間",
  "更新時間",
  "同步狀態",
  "可用彩別JSON",
];

const PERMISSION_HEADERS = [
  "會員等級",
  PERMISSION_LABELS.distributionChart,
  "二區分佈（已停用）",
  "統計表（已停用）",
  "連莊重複（已停用）",
  PERMISSION_LABELS.oddEvenRatio,
  "尾數（已停用）",
  PERMISSION_LABELS.headNumbers,
  "和值（已停用）",
  PERMISSION_LABELS.missingNumbers,
  PERMISSION_LABELS.trendBoard,
  PERMISSION_LABELS.combinationCalculator,
  PERMISSION_LABELS.columnCalculator,
  "更新時間",
];

const SYSTEM_SETTINGS_HEADERS = ["設定鍵", "設定值", "說明", "更新時間"];
const TREND_ANALYSIS_VISIBLE_KEY = "trendAnalysisVisible";

const nowIso = () => new Date().toISOString();
const statusToSheet = (status: DrawRecord["status"]) =>
  status === "active" ? "啟用" : status === "inactive" ? "停用" : "草稿";
const statusFromSheet = (status: string): DrawRecord["status"] =>
  status === "停用" ? "inactive" : status === "草稿" ? "draft" : "active";
const yesNo = (value: boolean) => (value ? "是" : "否");
const fromYesNo = (value: unknown) => ["是", "true", "TRUE", "1", "yes"].includes(String(value));
const permissionToLegacyColumns = (permissions: PermissionSet) =>
  LEGACY_PERMISSION_KEYS.map(key =>
    PERMISSION_KEYS.includes(key as (typeof PERMISSION_KEYS)[number])
      ? yesNo(permissions[key as (typeof PERMISSION_KEYS)[number]])
      : "否",
  );

let sheetsClient: sheets_v4.Sheets | null = null;
let schemaReady = false;
const DRAW_READ_CACHE_TTL_MS = 60_000;

function isSheetsReadQuotaError(error: unknown) {
  const candidate = error as {
    code?: number | string;
    response?: { status?: number; data?: { error?: { status?: string; message?: string } } };
    message?: string;
  };
  const status = candidate.response?.status ?? candidate.code;
  const detail = `${candidate.message ?? ""} ${candidate.response?.data?.error?.status ?? ""} ${candidate.response?.data?.error?.message ?? ""}`.toLowerCase();
  return status === 429 || status === "429" || detail.includes("quota") || detail.includes("rate limit") || detail.includes("resource_exhausted");
}

const drawRecordsCache = createTtlReadCache<DrawRecord[]>({
  ttlMs: DRAW_READ_CACHE_TTL_MS,
  canUseStaleOnError: isSheetsReadQuotaError,
});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`伺服器環境變數 ${name} 尚未設定`);
  return value;
}

function getSpreadsheetId() {
  return requiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
}

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: [SHEETS_SCOPE],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function getSheetId(title: string): Promise<number> {
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties(sheetId,title)",
  });
  const target = metadata.data.sheets?.find(sheet => sheet.properties?.title === title);
  if (target?.properties?.sheetId === undefined || target.properties.sheetId === null) {
    throw new Error(`找不到 Google 工作表：${title}`);
  }
  return target.properties.sheetId;
}

async function writeHeader(title: string, headers: string[]) {
  await getSheetsClient().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${title}!A1:${columnLetter(headers.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

function columnLetter(column: number): string {
  let value = column;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

export async function ensureSheetsSchema(): Promise<void> {
  if (schemaReady) return;
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties)",
  });

  const desired = new Map<string, number>([
    [DRAW_SHEET, DRAW_HEADERS.length],
    [IMAGE_SHEET, IMAGE_HEADERS.length],
    [MEMBER_SHEET, MEMBER_HEADERS.length],
    [PERMISSION_SHEET, PERMISSION_HEADERS.length],
    [SYSTEM_SETTINGS_SHEET, SYSTEM_SETTINGS_HEADERS.length],
  ]);
  const existing = new Map(
    (metadata.data.sheets ?? []).map(sheet => [sheet.properties?.title ?? "", sheet.properties]),
  );
  const requests: sheets_v4.Schema$Request[] = [];

  for (const [title, columnCount] of Array.from(desired.entries())) {
    const properties = existing.get(title);
    if (!properties) {
      requests.push({
        addSheet: { properties: { title, gridProperties: { rowCount: 2000, columnCount } } },
      });
    } else if ((properties.gridProperties?.columnCount ?? 0) < columnCount) {
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: properties.sheetId,
            gridProperties: { columnCount },
          },
          fields: "gridProperties.columnCount",
        },
      });
    }
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  await Promise.all([
    writeHeader(DRAW_SHEET, DRAW_HEADERS),
    writeHeader(IMAGE_SHEET, IMAGE_HEADERS),
    writeHeader(MEMBER_SHEET, MEMBER_HEADERS),
    writeHeader(PERMISSION_SHEET, PERMISSION_HEADERS),
    writeHeader(SYSTEM_SETTINGS_SHEET, SYSTEM_SETTINGS_HEADERS),
  ]);

  const permissionValues = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PERMISSION_SHEET}!A2:N3`,
  });
  if (!permissionValues.data.values?.some(row => row[0] === "regular")) {
    const timestamp = nowIso();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PERMISSION_SHEET}!A2:N3`,
      valueInputOption: "RAW",
      requestBody: {
        values: (["regular", "premium"] as const).map(level => [
          level,
          ...permissionToLegacyColumns(DEFAULT_PERMISSIONS[level]),
          timestamp,
        ]),
      },
    });
  }

  const systemSettingsValues = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SYSTEM_SETTINGS_SHEET}!A2:D`,
  });
  if (!systemSettingsValues.data.values?.some(row => row[0] === TREND_ANALYSIS_VISIBLE_KEY)) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SYSTEM_SETTINGS_SHEET}!A:D`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[TREND_ANALYSIS_VISIBLE_KEY, "是", "前台顯示分析工具區的走勢分析", nowIso()]],
      },
    });
  }

  schemaReady = true;
}

export async function getGoogleSheetsHealth() {
  await ensureSheetsSchema();
  const response = await getSheetsClient().spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "properties(title,locale,timeZone),sheets.properties.title",
  });
  return {
    connected: true as const,
    spreadsheetTitle: response.data.properties?.title ?? "",
    locale: response.data.properties?.locale ?? "",
    timeZone: response.data.properties?.timeZone ?? "",
    worksheets: response.data.sheets?.map(sheet => sheet.properties?.title).filter(Boolean) ?? [],
    checkedAt: new Date().toISOString(),
  };
}

function drawRow(record: DrawRecord): Array<string | number> {
  const numberColumns = Array.from({ length: 6 }, (_, index) => {
    const value = record.numbers[index];
    return value ? Number(value) : "";
  });
  return [
    LOTTERY_CONFIG[record.lotteryType].name,
    record.issue,
    record.drawDateRoc,
    ...numberColumns,
    record.specialNumber ? Number(record.specialNumber) : "",
    record.createdAt,
    record.updatedAt,
    statusToSheet(record.status),
  ];
}

function parseDrawRow(row: unknown[], index: number): DrawRecord | null {
  const lotteryType = LOTTERY_TYPE_BY_NAME[String(row[0] ?? "")];
  if (!lotteryType || !row[1] || !row[2]) return null;
  const drawDateRoc = String(row[2]);
  const ballCount = LOTTERY_CONFIG[lotteryType].ballCount;
  const legacyLayout = row[13] !== undefined;
  const specialValue = legacyLayout ? (row[10] || row[9]) : row[9];
  return {
    id: `${lotteryType}:${String(row[1])}`,
    lotteryType,
    issue: String(row[1]),
    drawDateRoc,
    drawDateIso: rocDateToIso(drawDateRoc),
    numbers: row.slice(3, 3 + ballCount).map(value => padBallNumber(String(value))),
    specialNumber: specialValue === "" || specialValue == null ? null : padBallNumber(String(specialValue)),
    createdAt: String(row[legacyLayout ? 11 : 10] ?? ""),
    updatedAt: String(row[legacyLayout ? 12 : 11] ?? ""),
    status: statusFromSheet(String(row[legacyLayout ? 13 : 12] ?? "啟用")),
  };
}

async function readAllDrawRecords(): Promise<DrawRecord[]> {
  return drawRecordsCache.read(async () => {
    await ensureSheetsSchema();
    const response = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${DRAW_SHEET}!A2:N`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    return (response.data.values ?? [])
      .map((row, index) => parseDrawRow(row, index + 2))
      .filter((record): record is DrawRecord => Boolean(record));
  });
}

export async function listDraws(input: {
  lotteryType: LotteryType;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  includeInactive?: boolean;
}): Promise<DrawRecord[]> {
  const records = (await readAllDrawRecords())
    .filter(record => record.lotteryType === input.lotteryType)
    .filter(record => input.includeInactive || record.status === "active")
    .filter(record => !input.fromDate || record.drawDateIso >= input.fromDate)
    .filter(record => !input.toDate || record.drawDateIso <= input.toDate)
    .sort((a, b) => b.drawDateIso.localeCompare(a.drawDateIso) || b.issue.localeCompare(a.issue));
  return typeof input.limit === "number" ? records.slice(0, input.limit) : records;
}

export async function upsertDraw(record: DrawRecord): Promise<DrawRecord> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${DRAW_SHEET}!A2:B`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(
    row => row[0] === LOTTERY_CONFIG[record.lotteryType].name && String(row[1]) === record.issue,
  );
  const row = drawRow(record);
  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${DRAW_SHEET}!A${sheetRow}:M${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${DRAW_SHEET}!A:M`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
  drawRecordsCache.invalidate();
  return record;
}

export async function batchUpsertDraws(records: DrawRecord[]): Promise<number> {
  for (const record of records) await upsertDraw(record);
  return records.length;
}

export async function deleteDraw(lotteryType: LotteryType, issue: string): Promise<boolean> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${DRAW_SHEET}!A2:B`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(
    row => row[0] === LOTTERY_CONFIG[lotteryType].name && String(row[1]) === issue,
  );
  if (rowIndex < 0) return false;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(DRAW_SHEET),
              dimension: "ROWS",
              startIndex: rowIndex + 1,
              endIndex: rowIndex + 2,
            },
          },
        },
      ],
    },
  });
  drawRecordsCache.invalidate();
  return true;
}

export async function listTrendImages(lotteryType?: LotteryType): Promise<TrendImage[]> {
  await ensureSheetsSchema();
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${IMAGE_SHEET}!A2:P`,
  });
  return (response.data.values ?? [])
    .map<TrendImage | null>(row => {
      const type = LOTTERY_TYPE_BY_NAME[String(row[1] ?? "")];
      if (!type || String(row[9] ?? "啟用") !== "啟用") return null;
      return {
        id: String(row[0]),
        lotteryType: type,
        url: String(row[2]),
        storageKey: row[3] ? String(row[3]) : null,
        source: row[4] === "upload" ? "upload" : row[4] === "google-drive" ? "google-drive" : "external",
        caption: String(row[5] ?? ""),
        sortOrder: Number(row[6] ?? 0),
        createdAt: String(row[7] ?? ""),
        updatedAt: String(row[8] ?? ""),
        driveFileId: row[10] ? String(row[10]) : null,
        driveFolderId: row[11] ? String(row[11]) : null,
        driveFileName: row[12] ? String(row[12]) : null,
        driveMimeType: row[13] ? String(row[13]) : null,
        driveModifiedTime: row[14] ? String(row[14]) : null,
        driveMd5Checksum: row[15] ? String(row[15]) : null,
      };
    })
    .filter((image): image is TrendImage => image !== null)
    .filter(image => !lotteryType || image.lotteryType === lotteryType)
    .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
}

export async function upsertTrendImage(image: TrendImage): Promise<TrendImage> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${IMAGE_SHEET}!A2:A`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(row => String(row[0]) === image.id);
  const row = [
    image.id,
    LOTTERY_CONFIG[image.lotteryType].name,
    image.url,
    image.storageKey ?? "",
    image.source,
    image.caption,
    image.sortOrder,
    image.createdAt,
    image.updatedAt,
    "啟用",
    image.driveFileId ?? "",
    image.driveFolderId ?? "",
    image.driveFileName ?? "",
    image.driveMimeType ?? "",
    image.driveModifiedTime ?? "",
    image.driveMd5Checksum ?? "",
  ];
  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${IMAGE_SHEET}!A${sheetRow}:P${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${IMAGE_SHEET}!A:P`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
  return image;
}

function trendImageRow(image: TrendImage) {
  return [
    image.id,
    LOTTERY_CONFIG[image.lotteryType].name,
    image.url,
    image.storageKey ?? "",
    image.source,
    image.caption,
    image.sortOrder,
    image.createdAt,
    image.updatedAt,
    "啟用",
    image.driveFileId ?? "",
    image.driveFolderId ?? "",
    image.driveFileName ?? "",
    image.driveMimeType ?? "",
    image.driveModifiedTime ?? "",
    image.driveMd5Checksum ?? "",
  ];
}

export async function replaceTrendImagesForLottery(
  lotteryType: LotteryType,
  images: TrendImage[],
): Promise<TrendImage[]> {
  if (images.some(image => image.lotteryType !== lotteryType)) {
    throw new Error("版路圖片批次更新包含錯誤彩別");
  }
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const all = await listTrendImages();
  const rows = [
    ...all.filter(image => image.lotteryType !== lotteryType),
    ...images,
  ].map(trendImageRow);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${IMAGE_SHEET}!A2:P` });
  if (rows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${IMAGE_SHEET}!A2:P${rows.length + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  }
  return images;
}

export async function deleteTrendImage(id: string): Promise<boolean> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${IMAGE_SHEET}!A2:A`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(row => String(row[0]) === id);
  if (rowIndex < 0) return false;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(IMAGE_SHEET),
              dimension: "ROWS",
              startIndex: rowIndex + 1,
              endIndex: rowIndex + 2,
            },
          },
        },
      ],
    },
  });
  return true;
}

export async function getGlobalPermissions(): Promise<Record<MemberLevel, PermissionSet>> {
  await ensureSheetsSchema();
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${PERMISSION_SHEET}!A2:N`,
  });
  const result = structuredClone(DEFAULT_PERMISSIONS);
  for (const row of response.data.values ?? []) {
    const level = row[0] as MemberLevel;
    if (level !== "regular" && level !== "premium") continue;
    result[level] = Object.fromEntries(
      PERMISSION_KEYS.map(key => [
        key,
        fromYesNo(row[LEGACY_PERMISSION_KEYS.indexOf(key) + 1]),
      ]),
    ) as PermissionSet;
  }
  return result;
}

export async function setGlobalPermissions(
  level: MemberLevel,
  permissions: PermissionSet,
): Promise<void> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PERMISSION_SHEET}!A2:A`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(row => row[0] === level);
  const row = [level, ...permissionToLegacyColumns(permissions), nowIso()];
  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PERMISSION_SHEET}!A${sheetRow}:N${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${PERMISSION_SHEET}!A:N`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
}

export async function getSiteSettings(): Promise<{ trendAnalysisVisible: boolean }> {
  await ensureSheetsSchema();
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${SYSTEM_SETTINGS_SHEET}!A2:D`,
  });
  const row = (response.data.values ?? []).find(value => value[0] === TREND_ANALYSIS_VISIBLE_KEY);
  return { trendAnalysisVisible: row ? fromYesNo(row[1]) : true };
}

export async function setSiteSettings(settings: { trendAnalysisVisible: boolean }): Promise<void> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SYSTEM_SETTINGS_SHEET}!A2:D`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(row => row[0] === TREND_ANALYSIS_VISIBLE_KEY);
  const row = [
    TREND_ANALYSIS_VISIBLE_KEY,
    yesNo(settings.trendAnalysisVisible),
    "前台顯示分析工具區的走勢分析",
    nowIso(),
  ];
  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SYSTEM_SETTINGS_SHEET}!A${sheetRow}:D${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SYSTEM_SETTINGS_SHEET}!A:D`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

export async function syncMemberToSheet(member: SheetMember): Promise<void> {
  await ensureSheetsSchema();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lookup = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MEMBER_SHEET}!A2:A`,
  });
  const rowIndex = (lookup.data.values ?? []).findIndex(row => String(row[0]) === member.memberId);
  const row = [
    member.memberId,
    member.username,
    member.name,
    member.email,
    member.phone,
    member.memberLevel,
    member.status,
    member.joinedAt,
    member.expiresAt,
    member.lastSignedInAt,
    Object.keys(member.customPermissions).length ? "是" : "否",
    JSON.stringify(member.customPermissions),
    member.notes,
    member.createdAt,
    member.updatedAt,
    "已同步",
    JSON.stringify(member.allowedLotteryTypes),
  ];
  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${MEMBER_SHEET}!A${sheetRow}:Q${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${MEMBER_SHEET}!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}
