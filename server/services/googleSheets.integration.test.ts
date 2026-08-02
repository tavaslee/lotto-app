import { describe, expect, it } from "vitest";
import {
  ensureSheetsSchema,
  getGoogleSheetsHealth,
  getGlobalPermissions,
  getSiteSettings,
  listDraws,
  listTrendImages,
} from "./googleSheets";
import { PERMISSION_KEYS } from "../../shared/lottery";

describe("Google Sheets lottery service", () => {
  it(
    "initializes the managed worksheets and reads each core data source",
    async () => {
      await expect(ensureSheetsSchema()).resolves.toBeUndefined();

      const [draws, images, permissions, siteSettings, health] = await Promise.all([
        listDraws({ lotteryType: "lotto649", limit: 10 }),
        listTrendImages("lotto649"),
        getGlobalPermissions(),
        getSiteSettings(),
        getGoogleSheetsHealth(),
      ]);

      expect(Array.isArray(draws)).toBe(true);
      expect(Array.isArray(images)).toBe(true);
      expect(Object.keys(permissions.regular)).toEqual(expect.arrayContaining([...PERMISSION_KEYS]));
      expect(Object.keys(permissions.premium)).toEqual(expect.arrayContaining([...PERMISSION_KEYS]));
      expect(siteSettings.trendAnalysisVisible).toEqual(expect.any(Boolean));
      expect(health).toMatchObject({
        connected: true,
        spreadsheetTitle: "樂透開獎資料",
        locale: "zh_TW",
        timeZone: "Asia/Taipei",
      });
    },
    30_000,
  );
});
