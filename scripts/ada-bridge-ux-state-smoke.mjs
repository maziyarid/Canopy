// Additional state coverage against explicitly isolated, authenticated fixtures.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const origin = process.env.MS_ROBOT_SMOKE_ORIGIN;
const directory = process.env.MS_ROBOT_SMOKE_FIXTURE_DIR;
const stage = process.env.MS_ROBOT_SMOKE_STATE;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.MS_ROBOT_SMOKE_FIXTURE, "isolated-test-data");
assert.ok(directory && directory === resolve(directory));
assert.ok(["large", "empty", "unavailable"].includes(stage));
const fixture = JSON.parse(readFileSync(join(directory, "browser-fixture.json"), "utf8"));
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const result = { stage };
try {
  const context = await browser.newContext({
    storageState: join(directory, "owner-session.json"),
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.name));
  await page.addInitScript(() =>
    localStorage.setItem("canopy-lang", JSON.stringify({ state: { lang: "en" }, version: 0 })),
  );
  await page.goto(origin + fixture.projectPath);
  await page.getByRole("button", { name: "Providers", exact: true }).click();
  let panel = page.getByRole("region", { name: "Ada events", exact: true });
  await panel.waitFor();
  if (stage === "large") {
    await panel.locator("li").first().waitFor();
    assert.equal(await panel.locator("li").count(), 20);
    assert.match(await panel.innerText(), /Showing 20 of 50 matching events/);
    await panel.getByRole("button", { name: "Show more events", exact: true }).click();
    assert.equal(await panel.locator("li").count(), 40);
    await panel.getByRole("button", { name: "Show more events", exact: true }).click();
    assert.equal(await panel.locator("li").count(), 50);
    assert.equal(
      await panel.getByRole("button", { name: "Show more events", exact: true }).count(),
      0,
    );
    const search = panel.getByRole("searchbox", { name: "Search events" });
    await search.fill("ux-fixture-");
    assert.equal(await panel.locator("li").count(), 20);
    assert.match(await panel.innerText(), /Showing 20 of 48 matching events/);
    await panel.getByRole("button", { name: "Clear search", exact: true }).click();
    await panel.getByRole("button", { name: /Unconfirmed/ }).click();
    assert.equal(await panel.locator("li").count(), 1);
    await panel.getByRole("button", { name: /All/ }).click();
    let intercepted = 0,
      release;
    let refreshPath;
    let armed = true;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const delay = async (route) => {
      if (armed && ["fetch", "xhr"].includes(route.request().resourceType())) {
        armed = false;
        intercepted++;
        refreshPath = new URL(route.request().url()).pathname;
        await pending;
      }
      await route.continue();
    };
    await page.route(origin + "/**", delay);
    const refresh = panel.getByRole("button", { name: "Check events again", exact: true });
    await refresh.click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.includes("Check events again") && b.disabled,
      ),
    );
    assert.equal(await refresh.getAttribute("aria-busy"), "true");
    assert.equal(await panel.locator("li").count(), 20);
    await refresh.evaluate((el) => el.click());
    assert.equal(intercepted, 1);
    assert.equal(
      await refresh.locator("svg").evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    release();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.includes("Check events again") && !b.disabled,
      ),
    );
    await page.unroute(origin + "/**", delay);
    result.slowRefreshSingleRequest = true;
    // A real transport failure must clear protected data and provide retry.
    armed = true;
    const fail = async (route) => {
      if (armed && new URL(route.request().url()).pathname === refreshPath) {
        armed = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"isolated fixture failure"}',
        });
      } else await route.continue();
    };
    await page.route(origin + "/**", fail);
    await refresh.click();
    await page.getByRole("button", { name: "Check providers again", exact: true }).waitFor();
    assert.equal(await panel.count(), 0);
    assert.equal(
      (await page.locator("body").innerText()).includes("isolated fixture failure"),
      false,
    );
    await page.unroute(origin + "/**", fail);
    await page.getByRole("button", { name: "Check providers again", exact: true }).click();
    await panel.locator("li").first().waitFor();
    assert.equal(await panel.locator("li").count(), 20);
    result.failureClearsProtectedDataRetryRestores = true;
    // Pending reads time out; their late response must not restore cleared data.
    armed = true;
    let aborted = false;
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === refreshPath) aborted = true;
    });
    let releaseTimeout;
    const timeoutPending = new Promise((resolve) => {
      releaseTimeout = resolve;
    });
    const stall = async (route) => {
      if (armed && new URL(route.request().url()).pathname === refreshPath) {
        armed = false;
        await timeoutPending;
      }
      await route.continue();
    };
    await page.route(origin + "/**", stall);
    await panel.getByRole("button", { name: "Check events again", exact: true }).click();
    await page
      .getByRole("button", { name: "Check providers again", exact: true })
      .waitFor({ timeout: 25000 });
    assert.equal(await panel.count(), 0);
    releaseTimeout();
    assert.equal(aborted, true);
    assert.equal(await panel.count(), 0);
    await page.unroute(origin + "/**", stall);
    await page.getByRole("button", { name: "Check providers again", exact: true }).click();
    await panel.locator("li").first().waitFor();
    result.timeoutAndLateResponseFenced = true;
    await page.setViewportSize({ width: 640, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    result.reflow = true;
    const scrollbar = await page.evaluate(() => {
      const el = document.createElement("div");
      el.style.cssText = "width:80px;height:40px;overflow:auto";
      el.innerHTML = '<div style="height:80px">fixture</div>';
      document.body.append(el);
      const value = getComputedStyle(el).scrollbarColor;
      el.remove();
      return value;
    });
    assert.notEqual(scrollbar, "auto");
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor),
      "auto",
    );
    result.scrollbarAndForcedColours = true;
    await page.emulateMedia({ forcedColors: "none" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(directory, "ada-events-large-desktop.png"),
      fullPage: false,
    });
  } else if (stage === "empty") {
    await panel
      .getByText("No event receipt has been recorded for this project yet.", { exact: true })
      .waitFor();
    assert.equal(await panel.locator("li").count(), 0);
    result.emptyDistinct = true;
  } else {
    await panel
      .getByText(
        "Event receipts are unavailable. Check again; existing project data is retained.",
        { exact: true },
      )
      .waitFor();
    await page.getByRole("heading", { name: "Data providers", exact: true }).waitFor();
    assert.equal(await panel.locator("li").count(), 0);
    assert.equal(
      await panel.getByRole("button", { name: "Check events again", exact: true }).isEnabled(),
      true,
    );
    result.adaOutagePreservesSiblingProviders = true;
  }
  assert.deepEqual(errors, []);
  writeFileSync(join(directory, `ada-ux-${stage}-evidence.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
