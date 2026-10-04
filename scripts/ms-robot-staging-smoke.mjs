// Explicitly provisioned loopback fixture only. Never point this at customer data.
import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const origin = process.env.MS_ROBOT_SMOKE_ORIGIN;
const fixtureDir = process.env.MS_ROBOT_SMOKE_FIXTURE_DIR;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.MS_ROBOT_SMOKE_FIXTURE, "isolated-test-data");
assert.ok(fixtureDir && fixtureDir === resolve(fixtureDir));
mkdirSync(fixtureDir, { recursive: true, mode: 0o700 });
const file = join(fixtureDir, "browser-fixture.json");
const fixture = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {
  owner: `owner-${Date.now()}@ms-robot.invalid`, client: `client-${Date.now()}@ms-robot.invalid`,
  password: randomBytes(24).toString("base64url"), name: "MS ROBOT TEST FIXTURE",
};
const save = () => writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
save();
const phase = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.MS_ROBOT_CHROMIUM_PATH, args: ["--no-sandbox"] });
const errors = [];
async function pageFor(label, storage) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(storage ? { storageState: storage } : {}) });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push({ label, name: error.name }));
  page.setDefaultTimeout(15000);
  return { context, page };
}
async function signUp(page, email) {
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: "New here? Create account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Staging test account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).waitFor();
}
async function report(page) {
  await page.goto(`${origin}${fixture.projectPath}`);
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page.getByRole("region", { name: "Client report", exact: true }).waitFor();
}
async function screenshot(page, label) {
  await page.screenshot({ path: join(fixtureDir, `${label}.png`), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label} overflow`);
}
try {
  if (phase === "prepare") {
    assert.ok(!fixture.projectPath, "Fixture already created; use owner/verify phases");
    const owner = await pageFor("owner");
    await signUp(owner.page, fixture.owner);
    await owner.page.getByRole("button", { name: "New project", exact: true }).click();
    await owner.page.getByLabel("Project name", { exact: true }).fill(fixture.name);
    await owner.page.getByLabel("Website", { exact: true }).fill("example.com");
    await owner.page.getByRole("button", { name: "Create", exact: true }).click();
    const link = owner.page.getByRole("link").filter({ hasText: fixture.name });
    await link.waitFor();
    fixture.projectPath = await link.getAttribute("href");
    assert.match(fixture.projectPath, /^\/p\/[a-z0-9-]+$/i);
    await owner.context.storageState({ path: join(fixtureDir, "owner-session.json") });
    const client = await pageFor("client");
    await signUp(client.page, fixture.client);
    await client.context.storageState({ path: join(fixtureDir, "client-session.json") });
    save();
    console.log(JSON.stringify({ phase, projectId: fixture.projectPath.slice(3), authenticated: true }));
  } else if (phase === "owner") {
    const owner = await pageFor("owner", join(fixtureDir, "owner-session.json"));
    await report(owner.page);
    const search = owner.page.getByRole("region", { name: "Client report" }).locator("li").filter({ has: owner.page.getByRole("heading", { name: "search", exact: true }) });
    assert.match(await search.innerText(), /63/);
    assert.match(await search.innerText(), /Partial Search data/);
    const notes = owner.page.getByRole("region", { name: "Manage evidence notes" });
    const manual = notes.locator("li").filter({ hasText: "Reviewed staging observation" });
    if (!await manual.count()) {
      await notes.getByLabel("Title", { exact: true }).fill("Reviewed staging observation");
      await notes.getByLabel("Note", { exact: true }).fill("Fixture Search measurements are partial; this is a staging review note.");
      await notes.getByRole("button", { name: "Save internal note" }).click();
      await manual.waitFor();
    }
    if (await manual.getByRole("button", { name: "Approve for client" }).count()) await manual.getByRole("button", { name: "Approve for client" }).click();
    await manual.getByRole("button", { name: "Keep internal" }).waitFor();
    await screenshot(owner.page, "owner-desktop");
    await owner.page.getByRole("button", { name: "Access", exact: true }).click();
    const member = owner.page.locator("li").filter({ hasText: fixture.client });
    if (!await member.count()) {
      await owner.page.getByLabel("Email", { exact: true }).fill(fixture.client);
      await owner.page.getByRole("button", { name: "Grant access", exact: true }).click();
      await member.waitFor();
    }
    const searchGrant = member.getByRole("checkbox", { name: "search", exact: true });
    if (!await searchGrant.isChecked()) await searchGrant.click();
    await owner.page.waitForFunction(email => [...document.querySelectorAll("li")].find(li => li.textContent.includes(email))?.querySelectorAll("input[type=checkbox]")[1]?.checked, fixture.client);
    await owner.page.waitForFunction(() => !document.querySelector("fieldset[disabled]"));
    assert.equal(await member.getByRole("checkbox", { name: "overview", exact: true }).isChecked(), false);
    console.log(JSON.stringify({ phase, partialMetrics: true, manualNoteApproved: true, grants: ["search"] }));
  } else if (phase === "verify") {
    const owner = await pageFor("owner", join(fixtureDir, "owner-session.json"));
    await report(owner.page);
    await owner.page.getByRole("region", { name: "Manage evidence notes" }).locator("li").filter({ hasText: "Reviewed staging observation" }).getByRole("button", { name: "Keep internal" }).waitFor();
    const client = await pageFor("client", join(fixtureDir, "client-session.json"));
    await report(client.page);
    const clientReport = client.page.getByRole("region", { name: "Client report", exact: true });
    assert.equal(await clientReport.locator("h2").count(), 1);
    assert.equal((await clientReport.locator("h2").innerText()).toLowerCase(), "search");
    assert.match(await clientReport.innerText(), /63/);
    assert.equal(await client.page.getByRole("button", { name: "Access", exact: true }).count(), 0);
    assert.equal(await client.page.getByRole("region", { name: "Manage evidence notes" }).count(), 0);
    await client.page.getByRole("region", { name: "Evidence notes" }).getByText("Reviewed staging observation", { exact: true }).waitFor();
    assert.equal(await client.page.getByText("Assistant", { exact: true }).count(), 0);
    await screenshot(client.page, "client-desktop");
    await client.page.setViewportSize({ width: 390, height: 844 });
    await screenshot(client.page, "client-mobile");
    const anonymous = await pageFor("anonymous");
    await anonymous.page.goto(`${origin}${fixture.projectPath}`);
    await anonymous.page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    assert.equal(await anonymous.page.getByRole("region", { name: "Client report" }).count(), 0);
    assert.deepEqual(errors, []);
    const result = { phase, ownerSessionAndNotePersisted: true, clientGrantAndApprovedNotePersisted: true, unapprovedNotesHidden: true, anonymousReportBlocked: true, desktopMobileOverflow: false, pageErrors: errors };
    writeFileSync(join(fixtureDir, "browser-evidence.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } else throw new Error("Expected prepare, owner, or verify phase");
} finally { await browser.close(); }
