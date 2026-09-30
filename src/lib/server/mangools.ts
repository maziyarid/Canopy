import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { studioAuth } from "./studio-auth";
import { ownerMangoolsKey } from "./access";
import {
  bindStoredMangoolsKey,
  mangoolsFetchWith,
  PublicMangoolsRequestSchema,
  type MangoolsRequestInput,
} from "./mangools-bind";

export {
  bindStoredMangoolsKey,
  PublicMangoolsRequestSchema,
  resolveMangoolsUrl,
  type MangoolsRequestInput,
  type PublicMangoolsRequestInput,
} from "./mangools-bind";

export async function mangoolsFetch(input: MangoolsRequestInput) {
  return mangoolsFetchWith(input, fetch);
}

export const mangoolsRequest = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(PublicMangoolsRequestSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!context.userId) throw new Error("Unauthorized");
    const key = await ownerMangoolsKey(sql, context.userId);
    return mangoolsFetch(bindStoredMangoolsKey(data, key));
  });
