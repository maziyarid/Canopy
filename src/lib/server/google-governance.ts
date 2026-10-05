import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { attachAmbientDataDomain } from "@/lib/ambient-data-domain";
import { resolveAccess } from "./access";
import { studioAuth } from "./studio-auth";
import {
  GOOGLE_ACTION_KEYS,
  GOOGLE_CAPABILITIES,
  GOOGLE_PROVIDERS,
  GOOGLE_ROLE_TEMPLATES,
} from "../google/google-capabilities";
import { GOOGLE_RESOURCE_TYPES } from "../google/google-actions";
import {
  activateGoogleConnectionProfile,
  disableGoogleConnectionProfile,
  grantGoogleCapability,
  listGoogleAccess,
  revokeGoogleCapability,
} from "../google/google-connections.server";
import {
  bindGoogleConnectionResources,
  discoverGoogleResources,
} from "../google/google-resource-discovery.server";
import {
  beginGoogleOAuthConnection,
} from "../google/google-oauth-flow.server";
import {
  cancelGoogleAction,
  listGoogleProposals,
  proposeGoogleAction,
} from "../google/google-proposals.server";
import { executeGovernedGoogleAction } from "../google/google-executor.server";
import {
  publishGoogleApprovalProposal,
  recordGoogleApprovalRequest,
} from "../google/google-approval-bridge.server";

const ProjectScope = z.object({
  projectId: z.string().min(1).max(100),
  ambientDataDomain: z.enum(["medical", "thesis", "other"]).optional(),
});

async function accessFor(context: { userId: string; email: string }, data: z.infer<typeof ProjectScope>) {
  const sql = await getSql();
  const access = await resolveAccess(
    sql,
    context.userId,
    context.email,
    data.projectId,
    data.ambientDataDomain,
  );
  return { sql, access };
}

export const getGoogleDelegatedAccess = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ProjectScope)
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    const [accessState, proposals] = await Promise.all([
      listGoogleAccess(sql, access),
      listGoogleProposals(sql, access),
    ]);
    return {
      projectId: data.projectId,
      ...accessState,
      proposals,
      roleTemplates: Object.fromEntries(
        Object.entries(GOOGLE_ROLE_TEMPLATES).map(([role, capabilities]) => [role, [...capabilities]]),
      ),
    };
  });

export const startGoogleWriteOAuth = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({
    provider: z.enum(GOOGLE_PROVIDERS),
    profileMode: z.enum(["write", "admin"]),
    scopes: z.array(z.string().min(1).max(300)).min(1).max(12),
  }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return beginGoogleOAuthConnection(sql, access, context.userId, {
      provider: data.provider,
      profileMode: data.profileMode,
      scopes: data.scopes,
    });
  });

export const discoverGoogleConnectionResources = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ profileId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return discoverGoogleResources(sql, access, context.userId, data.profileId);
  });

export const saveGoogleConnectionBindings = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({
    profileId: z.string().uuid(),
    bindings: z.array(z.object({
      type: z.enum(GOOGLE_RESOURCE_TYPES),
      ref: z.string().min(1).max(500),
    }).strict()).min(1).max(100),
  }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return bindGoogleConnectionResources(
      sql,
      access,
      context.userId,
      data.profileId,
      data.bindings,
    );
  });

export const activateGoogleWriteConnection = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ profileId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return activateGoogleConnectionProfile(sql, access, context.userId, data.profileId);
  });

export const disableGoogleWriteConnection = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ profileId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return disableGoogleConnectionProfile(sql, access, context.userId, data.profileId);
  });

export const saveGoogleCapabilityGrant = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({
    principalUserId: z.string().min(1).max(160),
    roleTemplate: z.enum(Object.keys(GOOGLE_ROLE_TEMPLATES) as [keyof typeof GOOGLE_ROLE_TEMPLATES, ...(keyof typeof GOOGLE_ROLE_TEMPLATES)[]]).optional(),
    capability: z.enum(GOOGLE_CAPABILITIES),
    connectionProfileId: z.string().uuid(),
    resourceType: z.enum(GOOGLE_RESOURCE_TYPES),
    resourceRef: z.string().min(1).max(500),
    expiresAt: z.string().datetime().nullable().optional(),
  }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return grantGoogleCapability(sql, access, context.userId, {
      principalUserId: data.principalUserId,
      roleTemplate: data.roleTemplate ?? "",
      capability: data.capability,
      connectionProfileId: data.connectionProfileId,
      resourceType: data.resourceType,
      resourceRef: data.resourceRef,
      expiresAt: data.expiresAt,
    });
  });

export const removeGoogleCapabilityGrant = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ grantId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return revokeGoogleCapability(sql, access, context.userId, data.grantId);
  });

export const createGoogleActionProposal = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({
    action: z.enum(GOOGLE_ACTION_KEYS),
    resourceRef: z.string().min(1).max(500),
    payload: z.record(z.string(), z.unknown()),
    idempotencyKey: z.string().min(1).max(120),
    snapshotHash: z.string().max(128).optional(),
  }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    const result = await proposeGoogleAction(sql, access, context.userId, {
      action: data.action,
      resourceRef: data.resourceRef,
      payload: data.payload,
      idempotencyKey: data.idempotencyKey,
      snapshotHash: data.snapshotHash,
    });
    if (!result.approvalEnvelope) {
      return { proposal: result.proposal, replayed: result.replayed, approval: "not_required" as const };
    }
    try {
      const bridge = await publishGoogleApprovalProposal({
        proposal: result.proposal,
        siteKey: access.project.domain,
      });
      await recordGoogleApprovalRequest(sql, result.proposal, context.userId, bridge.event_id);
      return {
        proposal: result.proposal,
        replayed: result.replayed,
        approval: "queued" as const,
        approvalRequestRef: bridge.event_id,
      };
    } catch {
      return {
        proposal: result.proposal,
        replayed: result.replayed,
        approval: "unavailable" as const,
      };
    }
  });

export const executeGrantedGoogleAction = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ proposalId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    return executeGovernedGoogleAction(sql, access, context.userId, data.proposalId, {});
  });

export const cancelPendingGoogleAction = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ proposalId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    await cancelGoogleAction(sql, access, context.userId, data.proposalId);
    return { ok: true as const };
  });
