// Run only against the disposable fixture prepared by ms-robot-staging-smoke.mjs.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const origin = process.env.MS_ROBOT_SMOKE_ORIGIN;
const dir = process.env.MS_ROBOT_SMOKE_FIXTURE_DIR;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.MS_ROBOT_SMOKE_FIXTURE, "isolated-test-data");
const fixture = JSON.parse(readFileSync(join(dir, "browser-fixture.json"), "utf8"));
const browser = await chromium.launch({ executablePath: process.env.MS_ROBOT_CHROMIUM_PATH, args: ["--no-sandbox"] });
const errors = [];
try {
  for (const role of ["owner", "client"]) {
    const context = await browser.newContext({ storageState: join(dir, `${role}-session.json`), viewport: { width: 1280, height: 800 } });
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.name));
    await page.goto(`${origin}${fixture.projectPath}`);
    await page.getByRole("button", { name: "Analytics", exact: true }).click();
    await page.getByLabel("Reporting period", { exact: true }).selectOption("last_7d");
    const currentDate = new Date(); currentDate.setUTCDate(currentDate.getUTCDate() - 2);
    await page.getByLabel("Period ending", { exact: true }).fill(currentDate.toISOString().slice(0,10));
    await page.getByRole("region", { name: "Period comparison", exact: true }).waitFor();
    await page.getByRole("region", { name: "Search queries and pages", exact: true }).getByText("fixture query", { exact: true }).waitFor();
    if (role === "owner") {
      const editor = page.getByRole("region", { name: "Manage evidence notes", exact: true });
      const title = `Historical window control ${Date.now()}`;
      await editor.getByLabel("Title", { exact: true }).fill(title);
      await editor.getByLabel("Note", { exact: true }).fill("Reviewed measurements for the selected historical window.");
      await editor.getByRole("button", { name: "Save internal note", exact: true }).click();
      const note = editor.locator("li").filter({ hasText: title });
      await note.waitFor(); assert.match(await note.innerText(), new RegExp(currentDate.toISOString().slice(0,10)));
    }
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const download = await downloadEvent; const path = join(dir, `${role}-report.csv`); await download.saveAs(path);
    const csv = readFileSync(path, "utf8"); assert.match(csv, /first_party/); assert.match(csv, /gsc/); assert.doesNotMatch(csv, /private@example.com|Authorization|Bearer/);
    await page.getByLabel("Compare previous period", { exact: true }).uncheck();
    await page.getByRole("region", { name: "Search queries and pages", exact: true }).waitFor();
    await page.getByRole("region", { name: "Period comparison", exact: true }).waitFor({ state: "detached" });
    await page.getByRole("region", { name: "Search queries and pages", exact: true }).getByText("fixture query", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("body *")].map(element => ({ tag: element.tagName, className: String(element.className), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })).filter(element => element.right > innerWidth + 1).slice(0,12) }));
    assert.equal(dimensions.scroll > dimensions.viewport, false, JSON.stringify(dimensions));
    await page.screenshot({ path: join(dir, `${role}-controls-mobile.png`), fullPage: true });
    await page.getByRole("button", { name: "فارسی", exact: true }).click();
    await page.getByRole("button", { name: "دریافت CSV", exact: true }).waitFor();
    await page.getByRole("region", { name: "عبارت‌های جست‌وجو و صفحات", exact: true }).getByText("fixture query", { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(dir, `${role}-controls-persian.png`), fullPage: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  const result = { ownerAndClientExport: true, measuredQueries: true, historicalEndDate: true, historicalNoteDates: true, comparisonToggle: true, englishMobile: true, persianRtlMobile: true, pageErrors: errors };
  writeFileSync(join(dir, "report-controls-evidence.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
