import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyPgliteAssets, isMissingOutputError, outputParentExists, pgliteAssetTarget, prepareNitroOutput } from "./copy-pglite-assets.mjs";

const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pglite-assets-"));
  try {
    const source = join(root, "node_modules", "@electric-sql", "pglite", "dist");
    await mkdir(source, { recursive: true });
    for (const name of files) await writeFile(join(source, name), `fixture:${name}`);
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

test("copies PGlite assets into the current node-server Nitro build", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".output", "server"), { recursive: true });
    await copyPgliteAssets(root, { NITRO_PRESET: "node-server" });
    for (const name of files) {
      assert.equal(
        await readFile(join(root, ".output", "server", "_libs", name), "utf8"),
        `fixture:${name}`,
      );
    }
    assert.equal(
      pgliteAssetTarget(root, { NITRO_PRESET: "node-server" }).preset,
      "node-server",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("copies PGlite assets into the default Vercel Nitro build", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".vercel", "output", "functions", "__server.func"), { recursive: true });
    await copyPgliteAssets(root, {});
    for (const name of files) {
      assert.equal(
        await readFile(join(root, ".vercel", "output", "functions", "__server.func", "_libs", name), "utf8"),
        `fixture:${name}`,
      );
    }
    assert.equal(pgliteAssetTarget(root, {}).preset, "vercel");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unsupported preset fails even when a stale supported output directory exists", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".vercel", "output", "functions", "__server.func"), { recursive: true });
    await assert.rejects(
      copyPgliteAssets(root, { NITRO_PRESET: "cloudflare-pages" }),
      /unsupported Nitro preset/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("selected preset fails closed when its current build output is missing", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".vercel", "output", "functions", "__server.func"), { recursive: true });
    await assert.rejects(
      copyPgliteAssets(root, { NITRO_PRESET: "node-server" }),
      /node-server build output not found/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare removes a stale same-preset output so it cannot satisfy the post-build copy gate", async () => {
  const root = await fixture();
  try {
    const stale = join(root, ".output", "server");
    await mkdir(stale, { recursive: true });
    await writeFile(join(stale, "stale-marker.txt"), "old build");

    await prepareNitroOutput(root, { NITRO_PRESET: "node-server" });

    await assert.rejects(
      copyPgliteAssets(root, { NITRO_PRESET: "node-server" }),
      /node-server build output not found/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("output existence reports only ENOENT and ENOTDIR as missing", async () => {
  assert.equal(isMissingOutputError(Object.assign(new Error("gone"), { code: "ENOENT" })), true);
  assert.equal(isMissingOutputError(Object.assign(new Error("not dir"), { code: "ENOTDIR" })), true);
  assert.equal(isMissingOutputError(Object.assign(new Error("denied"), { code: "EACCES" })), false);
  await assert.rejects(
    outputParentExists("/tmp/does-not-matter", async () => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    }),
    (error) => error.code === "EACCES",
  );
  assert.equal(
    await outputParentExists("/tmp/does-not-matter", async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }),
    false,
  );
});
