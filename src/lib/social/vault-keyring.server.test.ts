import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { parseVaultKeyring } from "./vault-keyring.server.ts";

test("vault keyring parses active version without exposing key contents", () => {
  const one = randomBytes(32).toString("base64");
  const two = randomBytes(32).toString("base64");
  const ring = parseVaultKeyring({
    MAZ_ROBOT_VAULT_ACTIVE_VERSION: "2",
    MAZ_ROBOT_VAULT_KEYS: JSON.stringify({ "1": one, "2": two }),
  } as NodeJS.ProcessEnv);
  assert.equal(ring.activeVersion, 2);
  assert.equal(ring.keys[2], two);
});

test("vault keyring fails closed when active key is missing", () => {
  const one = randomBytes(32).toString("base64");
  assert.throws(
    () => parseVaultKeyring({
      MAZ_ROBOT_VAULT_ACTIVE_VERSION: "2",
      MAZ_ROBOT_VAULT_KEYS: JSON.stringify({ "1": one }),
    } as NodeJS.ProcessEnv),
    /version 2 is not configured/,
  );
});
