import bcrypt from "bcryptjs";
import { parse } from "cookie";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import type { User } from "../../drizzle/schema";
import {
  LOTTERY_TYPES,
  PERMISSION_KEYS,
  type LotteryType,
  type PermissionSet,
  type SheetMember,
} from "../../shared/lottery";
import { getUserById, updateUserById } from "../db";
import { getGlobalPermissions, syncMemberToSheet } from "./googleSheets";

export const MEMBER_SESSION_COOKIE = "haobao_member_session";
export const MEMBER_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 64;
const scrypt = promisify(scryptCallback);

function getSessionSecret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET 尚未設定");
  return new TextEncoder().encode(value);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (passwordHash.startsWith("scrypt$")) {
    const [, salt, storedHex] = passwordHash.split("$");
    if (!salt || !storedHex) return false;
    try {
      const storedKey = Buffer.from(storedHex, "hex");
      const derivedKey = await scrypt(password, salt, storedKey.length) as Buffer;
      return storedKey.length > 0 && timingSafeEqual(storedKey, derivedKey);
    } catch {
      return false;
    }
  }
  return bcrypt.compare(password, passwordHash);
}

export function createMemberSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function createMemberSessionToken(userId: number, sessionId?: string): Promise<string> {
  return new SignJWT({ userId, kind: "member", ...(sessionId ? { sessionId } : {}) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

async function readMemberSessionPayload(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const token = parse(cookieHeader)[MEMBER_SESSION_COOKIE];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    if (payload.kind !== "member" || typeof payload.userId !== "number") return null;
    return {
      userId: payload.userId,
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId : null,
    };
  } catch {
    return null;
  }
}

export async function readMemberSession(req: Request): Promise<User | null> {
  const payload = await readMemberSessionPayload(req);
  if (!payload) return null;

  try {
    const user = await getUserById(payload.userId);
    if (!user || user.memberStatus !== "active") return null;
    if (user.membershipExpiresAt && user.membershipExpiresAt.getTime() < Date.now()) return null;
    if (
      user.role !== "admin"
      && (!payload.sessionId || payload.sessionId !== user.activeMemberSessionId)
    ) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function revokeMemberSession(req: Request): Promise<void> {
  const payload = await readMemberSessionPayload(req);
  if (!payload?.sessionId) return;
  const user = await getUserById(payload.userId);
  if (!user || user.activeMemberSessionId !== payload.sessionId) return;
  await updateUserById(user.id, { activeMemberSessionId: null });
}

export async function resolveEffectivePermissions(user: User): Promise<PermissionSet> {
  if (user.role === "admin") {
    return Object.fromEntries(PERMISSION_KEYS.map(key => [key, true])) as PermissionSet;
  }
  const globalPermissions = await getGlobalPermissions();
  const base = { ...globalPermissions[user.memberLevel] };
  if (user.useCustomPermissions && user.customPermissions) {
    for (const key of PERMISSION_KEYS) {
      const override = user.customPermissions[key];
      if (typeof override === "boolean") base[key] = override;
    }
  }
  return base;
}

export function resolveAllowedLotteryTypes(user: User): LotteryType[] {
  if (user.role === "admin" || user.memberLevel !== "premium" || user.allowedLotteryTypes === null) {
    return [...LOTTERY_TYPES];
  }
  return LOTTERY_TYPES.filter(type => user.allowedLotteryTypes?.includes(type));
}

export function canAccessLotteryType(user: User, lotteryType: LotteryType): boolean {
  return resolveAllowedLotteryTypes(user).includes(lotteryType);
}

export function publicMember(user: User) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    memberLevel: user.memberLevel,
    memberStatus: user.memberStatus,
    membershipExpiresAt: user.membershipExpiresAt,
    useCustomPermissions: user.useCustomPermissions,
    customPermissions: user.customPermissions ?? {},
    allowedLotteryTypes: resolveAllowedLotteryTypes(user),
    memberSyncStatus: user.memberSyncStatus,
    memberSyncedAt: user.memberSyncedAt,
    memberSyncError: user.memberSyncError,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
  };
}

export function toSheetMember(user: User): SheetMember {
  return {
    memberId: String(user.id),
    username: user.username ?? "",
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    memberLevel: user.memberLevel,
    status: user.memberStatus,
    joinedAt: user.createdAt.toISOString(),
    expiresAt: user.membershipExpiresAt?.toISOString() ?? "",
    lastSignedInAt: user.lastSignedIn.toISOString(),
    notes: user.notes ?? "",
    customPermissions: user.useCustomPermissions ? user.customPermissions ?? {} : {},
    allowedLotteryTypes: resolveAllowedLotteryTypes(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function buildMemberSyncUpdate(
  status: "pending" | "synced" | "failed",
  error?: unknown,
) {
  if (status === "pending") {
    return { memberSyncStatus: status, memberSyncError: null } as const;
  }
  if (status === "synced") {
    return {
      memberSyncStatus: status,
      memberSyncedAt: new Date(),
      memberSyncError: null,
    } as const;
  }
  const message = error instanceof Error ? error.message : String(error ?? "未知同步錯誤");
  return {
    memberSyncStatus: status,
    memberSyncError: message.slice(0, 1000),
  } as const;
}

export async function syncMemberSafely(user: User): Promise<string | null> {
  await updateUserById(user.id, buildMemberSyncUpdate("pending"));
  try {
    await syncMemberToSheet(toSheetMember(user));
    await updateUserById(user.id, buildMemberSyncUpdate("synced"));
    return null;
  } catch (error) {
    console.error("[MemberSync] Google Sheets sync failed", error);
    await updateUserById(user.id, buildMemberSyncUpdate("failed", error));
    return "會員資料已儲存於本地資料庫，但 Google Sheets 備份同步暫時失敗";
  }
}
