// Real authenticated UI checks. Only explicit disposable loopback fixtures.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const origin = process.env.MS_ROBOT_SMOKE_ORIGIN;
const directory = process.env.MS_ROBOT_SMOKE_FIXTURE_DIR;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.MS_ROBOT_SMOKE_FIXTURE, "isolated-test-data");
assert.ok(directory && directory === resolve(directory));
const fixture = JSON.parse(readFileSync(join(directory, "browser-fixture.json"), "utf8"));
assert.match(fixture.projectPath, /^\/p\/[a-z0-9-]+$/i);
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const errors = [];
const result = {};
async function session(name) {
  const context = await browser.newContext({
    storageState: join(directory, `${name}-session.json`),
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console-error");
  });
  return page;
}
async function grant(page, role) {
  await page.goto(origin + fixture.projectPath);
  await page.getByRole("button", { name: "Access", exact: true }).click();
  const member = page.locator("li").filter({ hasText: fixture.client });
  if (await member.count()) {
    await member.getByRole("button", { name: "Revoke", exact: true }).click();
    await member.waitFor({ state: "detached" });
  }
  await page.getByLabel("Email", { exact: true }).fill(fixture.client);
  assert.equal(await page.getByRole("combobox").count(), 1);
  await page.getByRole("combobox").selectOption(role);
  await page.getByRole("button", { name: "Grant access", exact: true }).click();
  await member.waitFor();
}
async function ownerView(page, lang, label) {
  await page.addInitScript(
    (value) =>
      localStorage.setItem("canopy-lang", JSON.stringify({ state: { lang: value }, version: 0 })),
    lang,
  );
  await page.goto(origin + fixture.projectPath, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: lang === "fa" ? "منابع داده" : "Providers", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: lang === "fa" ? "رویدادهای Ada" : "Ada events",
    exact: true,
  });
  await panel.getByText("incident-visible", { exact: true }).waitFor();
  assert.equal(await panel.locator("li").count(), 2);
  assert.match(
    await panel.innerText(),
    lang === "fa" ? /پیشنهاد؛ نیازمند مجوز/ : /Proposal; authorisation required/,
  );
  assert.match(
    await panel.innerText(),
    lang === "fa" ? /دریافت هنوز تایید نشده/ : /Acknowledgement unconfirmed/,
  );
  assert.equal((await page.locator("body").innerText()).includes("other-tenant-hidden"), false);
  assert.equal((await page.locator("body").innerText()).includes("other-site-hidden"), false);
  assert.equal(await panel.getByRole("button").count(), 1);
  await panel.getByRole("button").click();
  await panel.getByText("incident-visible", { exact: true }).waitFor();
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(directory, `${label}.png`), fullPage: false });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${label} overflow`,
  );
}
try {
  const owner = await session("owner");
  await ownerView(owner, "en", "ada-owner-desktop");
  const mobile = await session("owner");
  await mobile.setViewportSize({ width: 390, height: 844 });
  await ownerView(mobile, "fa", "ada-owner-mobile-fa");
  await grant(owner, "client");
  const client = await session("client");
  await client.goto(origin + fixture.projectPath);
  await client.getByRole("button", { name: "Analytics", exact: true }).waitFor();
  assert.equal(await client.getByRole("button", { name: "Providers", exact: true }).count(), 0);
  assert.equal(await client.getByRole("region", { name: "Ada events", exact: true }).count(), 0);
  result.clientHidden = true;
  await grant(owner, "editor");
  await client.reload();
  await client.getByRole("button", { name: "Providers", exact: true }).click();
  await client.getByRole("heading", { name: "Data providers", exact: true }).waitFor();
  assert.equal(await client.getByRole("region", { name: "Ada events", exact: true }).count(), 0);
  result.editorHidden = true;
  const anonymous = await browser.newPage();
  await anonymous.goto(origin + fixture.projectPath);
  await anonymous.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  assert.equal(await anonymous.getByRole("region", { name: "Ada events", exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  Object.assign(result, {
    ownerMetadataVisible: true,
    proposalInert: true,
    uncertainAckVisible: true,
    otherProjectAndSiteHidden: true,
    anonymousHidden: true,
    desktopMobileOverflow: false,
    pageErrors: errors,
  });
  writeFileSync(join(directory, "ada-browser-evidence.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
