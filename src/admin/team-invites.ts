import { createUuidV7 } from "@/domain/id";
import type { Hub, Invite, Role } from "@/domain/model";

function createInviteCode(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export function createInvite(hub: Hub, input: { actorId: string; actorRole: Role; role: "COOP_LEAD" | "FIELD_STAFF" | "MANUFACTURER" | "DISTRIBUTOR"; organizationId?: string; organizationName?: string; email?: string; maxUses: number; expiresAt: string; now?: Date }): Invite {
  const canInvite = input.actorRole === "HUB_ADMIN" || input.actorRole === "COOP_LEAD";
  if (!canInvite) throw new Error("Only hub admins and cooperative leads can create invites");
  if (input.actorRole === "HUB_ADMIN" && hub.status !== "VERIFIED") throw new Error("Hub must be verified before sending invites");
  if (input.actorRole === "COOP_LEAD" && input.role !== "FIELD_STAFF") throw new Error("Cooperative leads can only invite field staff");
  if (input.maxUses < 1 || !Number.isInteger(input.maxUses)) throw new Error("Invite uses must be a positive integer");
  if (new Date(input.expiresAt) <= (input.now ?? new Date())) throw new Error("Invite expiry must be in the future");

  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    id: createUuidV7(), code: createInviteCode(), hubId: hub.id, organizationId: input.organizationId, organizationName: input.organizationName, role: input.role, invitedById: input.actorId, email: input.email, maxUses: input.maxUses, uses: 0, expiresAt: input.expiresAt, createdById: input.actorId, createdAt: timestamp, updatedAt: timestamp,
  };
}