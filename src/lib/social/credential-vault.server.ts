import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type VaultCiphertext = {
  keyVersion: number;
  algorithm: "aes-256-gcm";
  nonceB64: string;
  ciphertextB64: string;
  authTagB64: string;
};

function keyFromBase64(encoded: string) {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MAZ_ROBOT_VAULT_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptCredential(
  plaintext: string,
  encodedKey: string,
  associatedData: string,
  keyVersion = 1,
): VaultCiphertext {
  if (!plaintext) throw new Error("credential plaintext is required");
  if (!associatedData) throw new Error("credential associated data is required");
  const key = keyFromBase64(encodedKey);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyVersion,
    algorithm: "aes-256-gcm",
    nonceB64: nonce.toString("base64"),
    ciphertextB64: ciphertext.toString("base64"),
    authTagB64: tag.toString("base64"),
  };
}

export function decryptCredential(
  record: VaultCiphertext,
  encodedKey: string,
  associatedData: string,
) {
  if (record.algorithm !== "aes-256-gcm") throw new Error("unsupported credential algorithm");
  const key = keyFromBase64(encodedKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.nonceB64, "base64"));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(Buffer.from(record.authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function vaultAssociatedData(input: {
  tenantId: string;
  projectId?: string;
  provider: string;
  credentialId: string;
}) {
  return [input.tenantId, input.projectId ?? "", input.provider, input.credentialId].join("|");
}
