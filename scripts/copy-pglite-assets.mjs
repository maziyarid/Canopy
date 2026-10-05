#!/usr/bin/env node
import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, "..");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function isMissingOutputError(error) {
  const code = error && typeof error === "object" ? error.code : undefined;
  return code === "ENOENT" || code === "ENOTDIR";
}

export async function outputParentExists(path, accessImpl = access) {
  try {
    await accessImpl(path);
    return true;
  } catch (error) {
    if (isMissingOutputError(error)) return false;
    throw error;
  }
}

export function pgliteAssetTarget(root, env = process.env) {
  const preset = env.NITRO_PRESET?.trim() || "vercel";
  if (preset === "vercel") {
    return {
      preset,
      parent: join(root, ".vercel", "output", "functions", "__server.func"),
      target: join(root, ".vercel", "output", "functions", "__server.func", "_libs"),
    };
  }
  if (preset === "node-server") {
    return {
      preset,
      parent: join(root, ".output", "server"),
      target: join(root, ".output", "server", "_libs"),
    };
  }
  throw new Error(`unsupported Nitro preset for PGlite asset packaging: ${preset}`);
}

export async function prepareNitroOutput(root = defaultRoot, env = process.env) {
  const { preset } = pgliteAssetTarget(root, env);
  const outputRoot =
    preset === "node-server"
      ? join(root, ".output")
      : join(root, ".vercel", "output");
  await rm(outputRoot, { recursive: true, force: true });
  console.log(`[pglite-assets] cleared stale ${preset} output`);
}

export async function copyPgliteAssets(root = defaultRoot, env = process.env, accessImpl = access) {
  const source = join(root, "node_modules", "@electric-sql", "pglite", "dist");
  const { preset, parent, target } = pgliteAssetTarget(root, env);
  if (!(await outputParentExists(parent, accessImpl))) {
    throw new Error(`Nitro ${preset} build output not found at ${parent}`);
  }

  await mkdir(target, { recursive: true });
  for (const name of files) {
    await copyFile(join(source, name), join(target, name));
    console.log(`[pglite-assets] copied ${name} -> ${preset}`);
  }
}

async function main() {
  if (process.argv.includes("--prepare")) {
    await prepareNitroOutput();
    return;
  }
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
