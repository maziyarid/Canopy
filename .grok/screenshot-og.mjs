import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const html = "/workspace/.grok/og-card.html";
const out = "/workspace/.grok/card-raw.png";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(html).href, { waitUntil: "load", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, type: "png", omitBackground: false });
  console.log(JSON.stringify({ ok: true, screenshot: out }));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
