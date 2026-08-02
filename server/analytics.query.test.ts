import { drizzle } from "drizzle-orm/mysql2";
import { describe, expect, it } from "vitest";
import { buildSiteAnalyticsDailyQuery } from "./db";

describe("site analytics daily query", () => {
  it("使用 TiDB 可執行的欄位序號分組，避免重複日期函式表達式", () => {
    const query = buildSiteAnalyticsDailyQuery(drizzle.mock(), new Date("2026-07-15T06:05:07.719Z")).toSQL();

    expect(query.sql).toContain("group by 1 order by 1");
    expect(query.sql).not.toContain("group by DATE_FORMAT");
    expect(query.params).toEqual(["2026-07-15 06:05:07.719"]);
  });
});
