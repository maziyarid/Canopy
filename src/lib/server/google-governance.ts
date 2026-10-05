import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { resolveAccess } from "./access";
import { studioAuth } from "./studio-auth";
import {
  GOOGLE_ACTION_KEYS,
  GOOGLE_ACTION_POLICIES,
  GOOGLE_CAPABILITIES,
  GOOGLE_PROVIDERS,
  GOOGLE_ROLE_TEMPLATES,
} from "../google/google-capabilities";
import { GOOGLE_RESOURCE_TYPES } from "../google/google-actions";
import {
  activateGoogleConnectionProfile,
  disableGoogleConnectionProfile,
  grantGoogleCapability,
  listEffectiveGoogleGrants,
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
  getGoogleActionProposal,
  googleProposalView,
  listActorGoogleProposals,
  listGoogleProposals,
  markGoogleActionExpired,
  markGoogleActionRejected,
  proposeGoogleAction,
} from "../google/google-proposals.server";
import { executeGovernedGoogleAction } from "../google/google-executor.server";
import {
  publishGoogleApprovalProposal,
  recordGoogleApprovalRequest,
} from "../google/google-approval-bridge.server";
import {
  claimAdaGoogleApprovalProof,
  consumeAdaGoogleApprovalProof,
  getAdaGoogleApproval,
  requestAdaGoogleApproval,
} from "../google/google-ada-control.server";

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

async function ensureGoogleApprovalRequest(
  sql: Awaited<ReturnType<typeof getSql>>,
  access: Awaited<ReturnType<typeof resolveAccess>>,
  actorRef: string,
  proposalId: string,
) {
  const proposal = await getGoogleActionProposal(sql, access.project.id, proposalId);
  if (!proposal) throw new Error("google_action_not_found");
  if (proposal.approvalPolicy !== "ada") return { proposal, approval: "not_required" as const };
  if (proposal.approvalRequestRef) {
    return { proposal, approval: "queued" as const, approvalRequestRef: proposal.approvalRequestRef };
  }
  const bridge = await publishGoogleApprovalProposal({ proposal, siteKey: access.project.domain });
  const ticket = await requestAdaGoogleApproval({
    proposal,
    siteKey: access.project.domain,
    bridgeEventId: bridge.event_id,
    requestedBy: actorRef,
  });
  await recordGoogleApprovalRequest(sql, proposal, actorRef, {
    ticketId: ticket.ticket_id,
    eventId: bridge.event_id,
  });
  return {
    proposal: { ...proposal, approvalRequestRef: ticket.ticket_id },
    approval: "queued" as const,
    approvalRequestRef: ticket.ticket_id,
  };
}

export const getGoogleActionWorkspace = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ProjectScope)
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    if (access.filter.trim()) throw new Error("Forbidden");
    const [grants, proposals] = await Promise.all([
      listEffectiveGoogleGrants(sql, access, context.userId),
      listActorGoogleProposals(sql, access, context.userId),
    ]);
    const allowedKeys = new Set(
      grants.flatMap((grant) =>
        GOOGLE_ACTION_KEYS.filter((action) => {
          const policy = GOOGLE_ACTION_POLICIES[action];
          return (
            policy.provider === grant.provider &&
            policy.capability === grant.capability &&
            policy.resourceType === grant.resourceType
          );
        }).map((action) => action + "\n" + grant.resourceRef),
      ),
    );
    const actions = [...allowedKeys].map((entry) => {
      const [action, resourceRef] = entry.split("\n");
      const policy = GOOGLE_ACTION_POLICIES[action as (typeof GOOGLE_ACTION_KEYS)[number]];
      return {
        action: action as (typeof GOOGLE_ACTION_KEYS)[number],
        provider: policy.provider,
        capability: policy.capability,
        resourceType: policy.resourceType,
        resourceRef,
        approval: policy.approval,
        mutationType: policy.mutationType,
      };
    });
    return {
      projectId: data.projectId,
      role: access.role,
      grants,
      actions,
      proposals,
      canManageDelegatedAccess: access.role === "owner",
    };
  });

export const getGoogleDelegatedAccess = createServerFn({ method: "GET" })
  .middleware([studioAuth])
  .validator(ProjectScope)
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    const [accessState, proposals, members] = await Promise.all([
      listGoogleAccess(sql, access),
      listGoogleProposals(sql, access),
      sql.query<{ user_id: string | null; email: string; role: string }>(
        "select user_id,email,role from project_access where project_id=$1 order by created_at",
        [data.projectId],
      ),
    ]);
    const principals = [
      { userId: access.project.owner_id, label: "Owner", role: "owner" },
      ...members
        .filter((member) => Boolean(member.user_id))
        .map((member) => ({
          userId: member.user_id as string,
          label: member.email || member.user_id || "Member",
          role: member.role,
        })),
    ];
    return {
      projectId: data.projectId,
      ...accessState,
      proposals,
      principals,
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
      return { proposal: googleProposalView(result.proposal), replayed: result.replayed, approval: "not_required" as const };
    }
    try {
      const queued = await ensureGoogleApprovalRequest(sql, access, context.userId, result.proposal.id);
      return {
        proposal: googleProposalView(queued.proposal),
        replayed: result.replayed,
        approval: queued.approval,
        approvalRequestRef: "approvalRequestRef" in queued ? queued.approvalRequestRef : undefined,
      };
    } catch {
      return {
        proposal: googleProposalView(result.proposal),
        replayed: result.replayed,
        approval: "unavailable" as const,
      };
    }
  });

export const syncApprovedGoogleAction = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .validator(ProjectScope.extend({ proposalId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sql, access } = await accessFor(context, data);
    let proposal = await getGoogleActionProposal(sql, access.project.id, data.proposalId);
    if (!proposal) throw new Error("google_action_not_found");
    if (proposal.actorRef !== context.userId && access.role !== "owner") throw new Error("Forbidden");
    if (proposal.approvalPolicy !== "ada") {
      return { proposal: googleProposalView(proposal), approval: "not_required" as const };
    }
    if (!proposal.approvalRequestRef) {
      try {
        const queued = await ensureGoogleApprovalRequest(sql, access, context.userId, proposal.id);
        proposal = queued.proposal;
      } catch {
        return { proposal: googleProposalView(proposal), approval: "unavailable" as const };
      }
    }
    const ticket = await getAdaGoogleApproval(proposal.approvalRequestRef);
    if (ticket.payload_hash !== proposal.payloadHash || ticket.proposal_id !== proposal.id) {
      throw new Error("ada_control_ticket_binding_mismatch");
    }
    if (ticket.state === "PENDING") return { proposal: googleProposalView(proposal), approval: "pending" as const };
    if (ticket.state === "DENIED") {
      if (proposal.status === "pending_approval") {
        await markGoogleActionRejected(sql, proposal.projectId, proposal.id, "ada:" + ticket.ticket_id, context.userId);
      }
      const current = await getGoogleActionProposal(sql, access.project.id, proposal.id);
      return { proposal: googleProposalView(current ?? proposal), approval: "denied" as const };
    }
    if (ticket.state === "EXPIRED") {
      if (proposal.status === "pending_approval") {
        await markGoogleActionExpired(sql, proposal.projectId, proposal.id, "ada:" + ticket.ticket_id, context.userId);
      }
      const current = await getGoogleActionProposal(sql, access.project.id, proposal.id);
      return { proposal: googleProposalView(current ?? proposal), approval: "expired" as const };
    }
    if (ticket.state === "CONSUMED") {
      return {
        proposal: googleProposalView(proposal),
        approval: proposal.status === "succeeded" ? "executed" as const : "consumed_reapproval_required" as const,
      };
    }
    const proof = await claimAdaGoogleApprovalProof(ticket.ticket_id);
    const execution = await executeGovernedGoogleAction(
      sql,
      access,
      context.userId,
      proposal.id,
      { approvalProof: proof },
      {
        consumeAdaApproval: async (_proposal, suppliedProof) => {
          if (suppliedProof.ticketId !== ticket.ticket_id) throw new Error("ada_approval_ticket_mismatch");
          return consumeAdaGoogleApprovalProof(suppliedProof);
        },
      },
    );
    const current = await getGoogleActionProposal(sql, access.project.id, proposal.id);
    return { proposal: googleProposalView(current ?? proposal), approval: "executed" as const, execution };
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
