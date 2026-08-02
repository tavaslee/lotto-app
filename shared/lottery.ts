export const LOTTERY_TYPES = [
  "lotto649",
  "superLotto638",
  "daily539",
  "markSix",
  "fantasy5",
] as const;

export type LotteryType = (typeof LOTTERY_TYPES)[number];

export type LotteryConfig = {
  key: LotteryType;
  name: string;
  shortName: string;
  ballCount: number;
  numberRanges: ReadonlyArray<{ min: number; max: number }>;
  specialNumberRange: { min: number; max: number } | null;
  accent: string;
  accentForeground: string;
};

const repeatRange = (count: number, max: number) =>
  Array.from({ length: count }, () => ({ min: 1, max })) as ReadonlyArray<{
    min: number;
    max: number;
  }>;

export const LOTTERY_CONFIG: Record<LotteryType, LotteryConfig> = {
  lotto649: {
    key: "lotto649",
    name: "大樂透",
    shortName: "大樂透",
    ballCount: 6,
    numberRanges: repeatRange(6, 49),
    specialNumberRange: { min: 1, max: 49 },
    accent: "#facc15",
    accentForeground: "#1c1917",
  },
  superLotto638: {
    key: "superLotto638",
    name: "威力彩",
    shortName: "威力彩",
    ballCount: 6,
    numberRanges: repeatRange(6, 38),
    specialNumberRange: { min: 1, max: 8 },
    accent: "#16a34a",
    accentForeground: "#ffffff",
  },
  daily539: {
    key: "daily539",
    name: "今彩539",
    shortName: "今彩539",
    ballCount: 5,
    numberRanges: repeatRange(5, 39),
    specialNumberRange: null,
    accent: "#f97316",
    accentForeground: "#ffffff",
  },
  markSix: {
    key: "markSix",
    name: "六合彩",
    shortName: "六合彩",
    ballCount: 6,
    numberRanges: repeatRange(6, 49),
    specialNumberRange: { min: 1, max: 49 },
    accent: "#dc2626",
    accentForeground: "#ffffff",
  },
  fantasy5: {
    key: "fantasy5",
    name: "加州天天樂",
    shortName: "天天樂",
    ballCount: 5,
    numberRanges: repeatRange(5, 39),
    specialNumberRange: null,
    accent: "#3b82f6",
    accentForeground: "#ffffff",
  },
};

export const LOTTERY_TYPE_BY_NAME = Object.fromEntries(
  Object.values(LOTTERY_CONFIG).map(config => [config.name, config.key]),
) as Record<string, LotteryType>;

export const LOTTERY_TYPE_BY_TREND_FOLDER_NAME: Record<string, LotteryType> = {
  "版路1-大樂透": "lotto649",
  "版路2-威力彩": "superLotto638",
  "版路3-今彩539": "daily539",
  "版路4-六合彩": "markSix",
  "版路5-加州天天樂": "fantasy5",
};

export const LEGACY_PERMISSION_KEYS = [
  "distributionChart",
  "dualZoneDistribution",
  "statisticsTable",
  "repeatedDraws",
  "oddEvenRatio",
  "tailNumbers",
  "headNumbers",
  "sumAnalysis",
  "missingNumbers",
  "trendBoard",
  "combinationCalculator",
  "columnCalculator",
] as const;

export const ANALYSIS_PERMISSION_KEYS = [
  "distributionChart",
  "oddEvenRatio",
  "headNumbers",
  "missingNumbers",
] as const;

export const PERMISSION_KEYS = [
  ...ANALYSIS_PERMISSION_KEYS,
  "trendBoard",
  "combinationCalculator",
  "columnCalculator",
] as const;

export const MANAGEABLE_PERMISSION_KEYS = PERMISSION_KEYS;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionSet = Record<PermissionKey, boolean>;
export type PermissionOverrides = Partial<PermissionSet>;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  distributionChart: "分布與統計表",
  oddEvenRatio: "單雙比與和值",
  headNumbers: "頭數與尾數",
  missingNumbers: "距今未開",
  trendBoard: "版路拖牌",
  combinationCalculator: "連碰計算",
  columnCalculator: "立柱計算",
};

export const DEFAULT_PERMISSIONS: Record<"regular" | "premium", PermissionSet> = {
  regular: {
    distributionChart: true,
    oddEvenRatio: true,
    headNumbers: true,
    missingNumbers: true,
    trendBoard: true,
    combinationCalculator: false,
    columnCalculator: false,
  },
  premium: Object.fromEntries(PERMISSION_KEYS.map(key => [key, true])) as PermissionSet,
};

export type MemberLevel = "regular" | "premium";
export type MemberStatus = "active" | "suspended" | "pending";

export type DrawRecord = {
  id: string;
  lotteryType: LotteryType;
  issue: string;
  drawDateRoc: string;
  drawDateIso: string;
  numbers: string[];
  specialNumber: string | null;
  status: "active" | "inactive" | "draft";
  createdAt: string;
  updatedAt: string;
};

export type TrendImage = {
  id: string;
  lotteryType: LotteryType;
  url: string;
  storageKey: string | null;
  source: "upload" | "external" | "google-drive";
  caption: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  driveFileName?: string | null;
  driveMimeType?: string | null;
  driveModifiedTime?: string | null;
  driveMd5Checksum?: string | null;
};

export type SheetMember = {
  memberId: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  memberLevel: MemberLevel;
  status: MemberStatus;
  joinedAt: string;
  expiresAt: string;
  lastSignedInAt: string;
  notes: string;
  customPermissions: PermissionOverrides;
  allowedLotteryTypes: LotteryType[];
  createdAt: string;
  updatedAt: string;
};

export const padBallNumber = (value: string | number) =>
  String(value).trim().padStart(2, "0");
