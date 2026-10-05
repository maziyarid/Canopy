import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyPgliteAssets, pgliteAssetTargets } from "./copy-pglite-assets.mjs";

const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pglite-assets-"));
  const source = join(root, "node_modules", "@electric-sql", "pglite", "dist");
  await mkdir(source, { recursive: true });
  for (const name of files) await writeFile(join(source, name), `fixture:${name}`);
  return root;
}

test("copies PGlite assets into a node-server Nitro build", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".output", "server"), { recursive: true });
    await copyPgliteAssets(root);
    for (const name of files) {
      assert.equal(
        await readFile(join(root, ".output", "server", "_libs", name), "utf8"),
        `fixture:${name}`,
      );
    }
    assert.deepEqual((await pgliteAssetTargets(root)).map((x) => x.label), ["node-server"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("copies PGlite assets into a Vercel Nitro build without creating node-server output", async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, ".vercel", "output", "functions", "__server.func"), { recursive: true });
    await copyPgliteAssets(root);
    for (const name of files) {
      assert.equal(
        await readFile(join(root, ".vercel", "output", "functions", "__server.func", "_libs", name), "utf8"),
        `fixture:${name}`,
      );
    }
    assert.deepEqual((await pgliteAssetTargets(root)).map((x) => x.label), ["vercel"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails closed when no supported Nitro build output exists", async () => {
  const root = await fixture();
  try {
    await assert.rejects(copyPgliteAssets(root), /no supported Nitro build output/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
