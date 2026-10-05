import { appHref } from "@/lib/public-paths";
export const SCRIPT_FILES = {
  "Code.gs": appHref("/canopy/Code.gs"),
  "appsscript.json": appHref("/canopy/appsscript.json"),
} as const;
