#!/usr/bin/env node
import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, "..");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function pgliteAssetTargets(root) {
  const candidates = [
    {
      parent: join(root, ".vercel", "output", "functions", "__server.func"),
      target: join(root, ".vercel", "output", "functions", "__server.func", "_libs"),
      label: "vercel",
    },
    {
      parent: join(root, ".output", "server"),
      target: join(root, ".output", "server", "_libs"),
      label: "node-server",
    },
  ];

  const targets = [];
  for (const candidate of candidates) {
    if (await exists(candidate.parent)) targets.push(candidate);
  }
  return targets;
}

export async function copyPgliteAssets(root = defaultRoot) {
  const source = join(root, "node_modules", "@electric-sql", "pglite", "dist");
  const targets = await pgliteAssetTargets(root);
  if (!targets.length) {
    throw new Error("no supported Nitro build output found (.vercel or .output/server)");
  }

  for (const { target, label } of targets) {
    await mkdir(target, { recursive: true });
    for (const name of files) {
      await copyFile(join(source, name), join(target, name));
      console.log(`[pglite-assets] copied ${name} -> ${label}`);
    }
  }
}

async function main() {
  await copyPgliteAssets();
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    console.error("[pglite-assets] failed:", error?.message || error);
    process.exit(1);
  });
}
