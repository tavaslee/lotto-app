import { importPKCS8, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

describe("Google Sheets server credentials", () => {
  it(
    "authenticates with the service account and reads the configured spreadsheet metadata",
    async () => {
      const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

      expect(spreadsheetId, "GOOGLE_SHEETS_SPREADSHEET_ID is required").toBeTruthy();
      expect(clientEmail, "GOOGLE_SERVICE_ACCOUNT_EMAIL is required").toBeTruthy();
      expect(privateKey, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is required").toContain(
        "BEGIN PRIVATE KEY",
      );

      const now = Math.floor(Date.now() / 1000);
      const signingKey = await importPKCS8(privateKey!, "RS256");
      const assertion = await new SignJWT({ scope: GOOGLE_SHEETS_SCOPE })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuer(clientEmail!)
        .setSubject(clientEmail!)
        .setAudience(GOOGLE_TOKEN_URL)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(signingKey);

      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      });

      expect(tokenResponse.status).toBe(200);
      const tokenBody = (await tokenResponse.json()) as { access_token?: string };
      expect(tokenBody.access_token).toBeTruthy();

      const metadataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,properties.locale,properties.timeZone,sheets.properties.title`,
        { headers: { authorization: `Bearer ${tokenBody.access_token}` } },
      );

      expect(metadataResponse.status).toBe(200);
      const metadata = (await metadataResponse.json()) as {
        properties?: { title?: string; locale?: string; timeZone?: string };
        sheets?: Array<{ properties?: { title?: string } }>;
      };

      expect(metadata.properties).toMatchObject({
        title: "樂透開獎資料",
        locale: "zh_TW",
        timeZone: "Asia/Taipei",
      });
      expect(metadata.sheets?.map(sheet => sheet.properties?.title)).toEqual(
        expect.arrayContaining(["開獎資料", "彩別設定", "會員資料", "權限設定", "系統設定"]),
      );
    },
    20_000,
  );
});
