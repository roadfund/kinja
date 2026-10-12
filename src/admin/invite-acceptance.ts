import { validateInvite } from "@/auth/invites";
import { createUuidV7 } from "@/domain/id";
import type { Invite, Membership } from "@/domain/model";

export function acceptInvite(invite: Invite, input: { userId: string; now?: Date }): { invite: Invite; membership: Membership } {
  const now = input.now ?? new Date();
  validateInvite(invite, { now });
  const timestamp = now.toISOString();
  return {
    invite: { ...invite, uses: invite.uses + 1, updatedAt: timestamp },
    membership: {
      id: createUuidV7(), userId: input.userId, hubId: invite.hubId, organizationId: invite.organizationId, role: invite.role, status: "ACTIVE", createdById: input.userId, createdAt: timestamp, updatedAt: timestamp,
    },
  };
}