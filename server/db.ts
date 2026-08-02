import { and, asc, count, countDistinct, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import {
  carouselSettings,
  carouselSlides,
  siteVisits,
  type InsertCarouselSlide,
  type InsertSiteVisit,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export const usernameLookupHash = (username: string) =>
  createHash("sha256").update(username).digest("hex");

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.usernameHash, usernameLookupHash(username))).limit(1);
  return result[0];
}

export async function getUserByUsernameOrEmail(identifier: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.usernameHash, usernameLookupHash(identifier)), eq(users.email, identifier)))
    .limit(1);
  return result[0];
}

export async function createLocalUser(user: Omit<InsertUser, "openId"> & { openId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  const openId = user.openId ?? `local:${crypto.randomUUID()}`;
  const result = await db.insert(users).values({
    ...user,
    openId,
    usernameHash: user.username ? usernameLookupHash(user.username) : user.usernameHash,
  });
  return getUserById(Number(result[0].insertId));
}

export async function listMemberUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserById(id: number, updates: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  await db.update(users).set(updates).where(eq(users.id, id));
  return getUserById(id);
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  await db.delete(users).where(eq(users.id, id));
}

export const DEFAULT_CAROUSEL_SETTINGS = {
  isVisible: false,
  autoplay: true,
  intervalMs: 1000,
} as const;

export async function listCarouselSlides(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(carouselSlides);
  return includeInactive
    ? query.orderBy(asc(carouselSlides.sortOrder), asc(carouselSlides.id))
    : query
        .where(eq(carouselSlides.isActive, true))
        .orderBy(asc(carouselSlides.sortOrder), asc(carouselSlides.id));
}

export async function createCarouselSlide(slide: InsertCarouselSlide) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  const result = await db.insert(carouselSlides).values(slide);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(carouselSlides).where(eq(carouselSlides.id, id)).limit(1);
  return rows[0];
}

export async function updateCarouselSlide(
  id: number,
  updates: Partial<Pick<InsertCarouselSlide, "isActive" | "sortOrder">>,
) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  await db.update(carouselSlides).set(updates).where(eq(carouselSlides.id, id));
  const rows = await db.select().from(carouselSlides).where(eq(carouselSlides.id, id)).limit(1);
  return rows[0];
}

export async function deleteCarouselSlide(id: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  const rows = await db.select().from(carouselSlides).where(eq(carouselSlides.id, id)).limit(1);
  if (!rows[0]) return undefined;
  await db.delete(carouselSlides).where(eq(carouselSlides.id, id));
  return rows[0];
}

export async function deleteCarouselSlides(ids: number[]) {
  if (!ids.length) return [];
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  const rows = await db.select().from(carouselSlides).where(inArray(carouselSlides.id, ids));
  if (!rows.length) return [];
  await db.transaction(async tx => {
    await tx.delete(carouselSlides).where(inArray(carouselSlides.id, rows.map(row => row.id)));
    const remaining = await tx
      .select({ id: carouselSlides.id })
      .from(carouselSlides)
      .orderBy(asc(carouselSlides.sortOrder), asc(carouselSlides.id));
    for (let sortOrder = 0; sortOrder < remaining.length; sortOrder += 1) {
      await tx.update(carouselSlides).set({ sortOrder }).where(eq(carouselSlides.id, remaining[sortOrder].id));
    }
  });
  return rows;
}

export async function reorderCarouselSlides(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  const current = await listCarouselSlides(true);
  const currentIds = current.map(slide => slide.id).sort((a, b) => a - b);
  const nextIds = [...orderedIds].sort((a, b) => a - b);
  if (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])) {
    throw new Error("輪播排序清單已變更，請重新整理後再試");
  }
  await db.transaction(async tx => {
    for (let sortOrder = 0; sortOrder < orderedIds.length; sortOrder += 1) {
      await tx.update(carouselSlides).set({ sortOrder }).where(eq(carouselSlides.id, orderedIds[sortOrder]));
    }
  });
  return listCarouselSlides(true);
}

export async function getCarouselSettings() {
  const db = await getDb();
  if (!db) return { ...DEFAULT_CAROUSEL_SETTINGS };
  const rows = await db.select().from(carouselSettings).where(eq(carouselSettings.id, 1)).limit(1);
  const row = rows[0];
  return row
    ? { isVisible: row.isVisible, autoplay: row.autoplay, intervalMs: row.intervalMs }
    : { ...DEFAULT_CAROUSEL_SETTINGS };
}

export async function saveCarouselSettings(settings: {
  isVisible: boolean;
  autoplay: boolean;
  intervalMs: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  await db
    .insert(carouselSettings)
    .values({ id: 1, ...settings })
    .onDuplicateKeyUpdate({ set: settings });
  return getCarouselSettings();
}

export async function recordSiteVisit(visit: InsertSiteVisit) {
  const db = await getDb();
  if (!db) return;
  await db.insert(siteVisits).values(visit);
}

const taipeiDateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(date);

export function buildSiteAnalyticsDailyQuery(db: ReturnType<typeof drizzle>, since: Date) {
  const dayExpression = sql<string>`DATE_FORMAT(CONVERT_TZ(${siteVisits.occurredAt}, '+00:00', '+08:00'), '%Y-%m-%d')`;
  const firstSelectedColumn = sql.raw("1");
  return db
    .select({ date: dayExpression, pageViews: count(), visitors: countDistinct(siteVisits.visitorId) })
    .from(siteVisits)
    .where(gte(siteVisits.occurredAt, since))
    .groupBy(firstSelectedColumn)
    .orderBy(firstSelectedColumn);
}

export async function getSiteAnalytics(days: 7 | 30 | 90) {
  const db = await getDb();
  if (!db) throw new Error("資料庫目前無法使用");
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const todayStart = new Date(`${taipeiDateKey(now)}T00:00:00+08:00`);

  const [totalsRows, todayRows, dailyRows, pageRows, deviceRows, referrerRows] = await Promise.all([
    db.select({ pageViews: count(), visitors: countDistinct(siteVisits.visitorId) }).from(siteVisits).where(gte(siteVisits.occurredAt, since)),
    db.select({ pageViews: count(), visitors: countDistinct(siteVisits.visitorId) }).from(siteVisits).where(gte(siteVisits.occurredAt, todayStart)),
    buildSiteAnalyticsDailyQuery(db, since),
    db.select({ path: siteVisits.path, count: count() }).from(siteVisits).where(gte(siteVisits.occurredAt, since)).groupBy(siteVisits.path).orderBy(desc(count())).limit(8),
    db.select({ device: siteVisits.device, count: count() }).from(siteVisits).where(gte(siteVisits.occurredAt, since)).groupBy(siteVisits.device).orderBy(desc(count())),
    db.select({ referrer: siteVisits.referrerHost, count: count() }).from(siteVisits).where(gte(siteVisits.occurredAt, since)).groupBy(siteVisits.referrerHost).orderBy(desc(count())).limit(8),
  ]);

  const dailyByDate = new Map(dailyRows.map(row => [row.date, { pageViews: row.pageViews, visitors: row.visitors }]));
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - 1 - index) * 86_400_000);
    const key = taipeiDateKey(date);
    return { date: key, pageViews: dailyByDate.get(key)?.pageViews ?? 0, visitors: dailyByDate.get(key)?.visitors ?? 0 };
  });
  const totals = totalsRows[0] ?? { pageViews: 0, visitors: 0 };
  const today = todayRows[0] ?? { pageViews: 0, visitors: 0 };
  return {
    days,
    totals: { ...totals, pagesPerVisitor: totals.visitors ? Number((totals.pageViews / totals.visitors).toFixed(2)) : 0 },
    today,
    daily,
    topPages: pageRows,
    devices: deviceRows,
    referrers: referrerRows.map(row => ({ referrer: row.referrer || "直接流量", count: row.count })),
    generatedAt: now.toISOString(),
  };
}
