import { createUuidV7 } from "@/domain/id";
import type { Hub, HubVerification, Role } from "@/domain/model";

export function reviewHub(hub: Hub, input: { actorId: string; actorRole: Role; decision: "VERIFIED" | "REJECTED"; reason?: string; now?: Date }): { hub: Hub; verification: HubVerification } {
  if (input.actorRole !== "TECH_ADMIN") throw new Error("Only tech admins can review hubs");
  if (hub.status !== "PENDING_VERIFICATION") throw new Error("Only pending hubs can be reviewed");
  if (input.decision === "REJECTED" && !input.reason?.trim()) throw new Error("A rejection reason is required");

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const reviewedHub: Hub = { ...hub, status: input.decision, updatedAt: timestamp };
  const verification: HubVerification = {
    id: createUuidV7(),
    hubId: hub.id,
    reviewedById: input.actorId,
    decision: input.decision,
    reason: input.reason?.trim(),
    reviewedAt: timestamp,
    createdById: input.actorId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { hub: reviewedHub, verification };
}