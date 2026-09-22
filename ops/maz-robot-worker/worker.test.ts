import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { parseVaultKeyring, telegramInput } from "./worker.ts";

test("worker keyring parser requires the active key and supports versioned rotation keys", () => {
  const one=randomBytes(32).toString("base64");
  const two=randomBytes(32).toString("base64");
  const ring=parseVaultKeyring({
    MAZ_ROBOT_VAULT_ACTIVE_VERSION:"2",
    MAZ_ROBOT_VAULT_KEYS:JSON.stringify({"1":one,"2":two}),
  } as NodeJS.ProcessEnv);
  assert.equal(ring.activeVersion,2);
  assert.equal(ring.keys[1],one);
  assert.equal(ring.keys[2],two);
  assert.throws(()=>parseVaultKeyring({MAZ_ROBOT_VAULT_ACTIVE_VERSION:"2",MAZ_ROBOT_VAULT_KEYS:JSON.stringify({"1":one})} as NodeJS.ProcessEnv));
});

test("worker maps generic media manifest into bounded Telegram input", () => {
  const input=telegramInput({
    credentialRef:"c",
    accountRef:"@channel",
    body:"hello",
    mediaManifest:[
      {kind:"image",url:"https://e/a.jpg"},
      {kind:"unknown",url:"https://e/nope"},
    ],
  });
  assert.equal(input.chatId,"@channel");
  assert.equal(input.text,"hello");
  assert.deepEqual(input.media,[{kind:"image",url:"https://e/a.jpg"}]);
});
