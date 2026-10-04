import { randomUUID } from "node:crypto";
import type { Sql } from "../db.ts";
import {
  decryptCredential,
  encryptCredential,
  vaultAssociatedData,
  type VaultCiphertext,
} from "./credential-vault.server.ts";

export type VaultKeyring = {
  activeVersion: number;
  keys: Record<number, string>;
};

type VaultRow = {
  id: string;
  tenant_id: string;
  project_id: string;
  provider: string;
  label: string;
  key_version: number;
  algorithm: "aes-256-gcm";
  nonce_b64: string;
  ciphertext_b64: string;
  auth_tag_b64: string;
};

async function projectTenant(sql: Sql, projectId: string) {
  const rows = await sql.query<{ tenant_id: string }>(
    "select tenant_id from projects where id=$1 limit 1",
    [projectId],
  );
  const tenantId = rows[0]?.tenant_id;
  if (!tenantId) throw new Error("project tenant not found");
  return tenantId;
}

function cipherFromRow(row: VaultRow): VaultCiphertext {
  return {
    keyVersion: Number(row.key_version),
    algorithm: row.algorithm,
    nonceB64: row.nonce_b64,
    ciphertextB64: row.ciphertext_b64,
    authTagB64: row.auth_tag_b64,
  };
}

function keyFor(keyring: VaultKeyring, version: number) {
  const key = keyring.keys[version];
  if (!key) throw new Error(`vault key version ${version} is unavailable`);
  return key;
}

async function receipt(
  sql: Sql,
  input: {
    projectId: string;
    actorRef: string;
    operation: string;
    targetRef: string;
    status?: string;
    evidence?: Record<string, unknown>;
  },
) {
  await sql.query(
    `insert into operation_receipts
      (id,project_id,actor_ref,operation,target_ref,status,approval_ref,idempotency_key,evidence)
     values($1,$2,$3,$4,$5,$6,'',$7,$8)`,
    [
      randomUUID(),
      input.projectId,
      input.actorRef,
      input.operation,
      input.targetRef,
      input.status ?? "succeeded",
      randomUUID(),
      JSON.stringify(input.evidence ?? {}),
    ],
  );
}

export async function storeCredential(
  sql: Sql,
  keyring: VaultKeyring,
  input: {
    projectId: string;
    provider: string;
    label?: string;
    plaintext: string;
    actorRef: string;
  },
) {
  const tenantId = await projectTenant(sql, input.projectId);
  const id = randomUUID();
  const version = keyring.activeVersion;
  const aad = vaultAssociatedData({
    tenantId,
    projectId: input.projectId,
    provider: input.provider,
    credentialId: id,
  });
  const encrypted = encryptCredential(input.plaintext, keyFor(keyring, version), aad, version);
  await sql.query(
    `insert into credential_vault
      (id,tenant_id,project_id,provider,label,key_version,algorithm,nonce_b64,ciphertext_b64,auth_tag_b64,created_by)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, tenantId, input.projectId, input.provider, input.label ?? "", version,
      encrypted.algorithm, encrypted.nonceB64, encrypted.ciphertextB64, encrypted.authTagB64,
      input.actorRef,
    ],
  );
  await receipt(sql, {
    projectId: input.projectId,
    actorRef: input.actorRef,
    operation: "credential.store",
    targetRef: id,
    evidence: { provider: input.provider, keyVersion: version },
  });
  return { credentialRef: id, keyVersion: version };
}

async function scopedRow(sql: Sql, credentialRef: string, projectId: string) {
  const rows = await sql.query<VaultRow>(
    `select id,tenant_id,project_id,provider,label,key_version,algorithm,nonce_b64,ciphertext_b64,auth_tag_b64
     from credential_vault where id=$1 and project_id=$2 limit 1`,
    [credentialRef, projectId],
  );
  if (!rows[0]) throw new Error("credential not found in project scope");
  return rows[0];
}

function decryptRow(row: VaultRow, keyring: VaultKeyring) {
  const aad = vaultAssociatedData({
    tenantId: row.tenant_id,
    projectId: row.project_id,
    provider: row.provider,
    credentialId: row.id,
  });
  return decryptCredential(cipherFromRow(row), keyFor(keyring, Number(row.key_version)), aad);
}

export async function resolveCredential(
  sql: Sql,
  keyring: VaultKeyring,
  input: { credentialRef: string; projectId: string; actorRef: string },
) {
  const row = await scopedRow(sql, input.credentialRef, input.projectId);
  const plaintext = decryptRow(row, keyring);
  await receipt(sql, {
    projectId: input.projectId,
    actorRef: input.actorRef,
    operation: "credential.read",
    targetRef: row.id,
    evidence: { provider: row.provider, keyVersion: Number(row.key_version) },
  });
  return plaintext;
}

export async function rotateCredential(
  sql: Sql,
  keyring: VaultKeyring,
  input: {
    credentialRef: string;
    projectId: string;
    actorRef: string;
    targetVersion?: number;
  },
) {
  const row = await scopedRow(sql, input.credentialRef, input.projectId);
  const plaintext = decryptRow(row, keyring);
  const version = input.targetVersion ?? keyring.activeVersion;
  const aad = vaultAssociatedData({
    tenantId: row.tenant_id,
    projectId: row.project_id,
    provider: row.provider,
    credentialId: row.id,
  });
  const encrypted = encryptCredential(plaintext, keyFor(keyring, version), aad, version);
  await sql.query(
    `update credential_vault
     set key_version=$2,algorithm=$3,nonce_b64=$4,ciphertext_b64=$5,auth_tag_b64=$6,updated_at=now()
     where id=$1 and project_id=$7`,
    [
      row.id, version, encrypted.algorithm, encrypted.nonceB64,
      encrypted.ciphertextB64, encrypted.authTagB64, input.projectId,
    ],
  );
  await receipt(sql, {
    projectId: input.projectId,
    actorRef: input.actorRef,
    operation: "credential.rotate",
    targetRef: row.id,
    evidence: {
      provider: row.provider,
      fromKeyVersion: Number(row.key_version),
      toKeyVersion: version,
    },
  });
  return { credentialRef: row.id, keyVersion: version };
}
