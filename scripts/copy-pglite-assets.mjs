#!/usr/bin/env node
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const source = join(root, "node_modules", "@electric-sql", "pglite", "dist");
const target = join(root, ".vercel", "output", "functions", "__server.func", "_libs");

const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

async function main() {
  await mkdir(target, { recursive: true });
  for (const name of files) {
    await copyFile(join(source, name), join(target, name));
    console.log(`[pglite-assets] copied ${name}`);
  }
}

main().catch((error) => {
  console.error("[pglite-assets] failed:", error?.message || error);
  process.exit(1);
});