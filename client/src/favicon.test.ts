import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("網站 favicon", () => {
  it("使用與首頁品牌相同的金元寶 SVG 圖形", () => {
    const html = readFileSync(resolve(projectRoot, "client/index.html"), "utf8");
    const favicon = readFileSync(resolve(projectRoot, "client/public/favicon.svg"), "utf8");

    expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"');
    expect(html).toContain('rel="shortcut icon" href="/favicon.svg"');
    expect(favicon).toContain("財神金元寶");
    expect(favicon).toContain("M8.3 13.4c.7-5 3.2-8.2 7.7-8.2s7 3.2 7.7 8.2");
    expect(favicon).toContain("M3.5 14.2c1.8 1.7 4.1 2.8 6.7 3.4");
  });
});
