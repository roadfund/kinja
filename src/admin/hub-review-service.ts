import { z } from "zod";
import { reviewHub } from "@/admin/hub-verification";
import { requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import type { Hub } from "@/domain/model";
import { getRepository } from "@/repositories/server";

export const HubReviewInput = z.object({ hubId: z.string().min(1), decision: z.enum(["VERIFIED", "REJECTED"]), reason: z.string().optional() });

export async function listPendingHubs(account: Account): Promise<Hub[]> {
  requireRole(account, ["TECH_ADMIN"]);
  return (await getRepository().list("Hub")).filter((hub) => hub.status === "PENDING_VERIFICATION").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Only tech admins can verify or reject hubs, and every decision is recorded.
export async function reviewHubById(account: Account, input: unknown, now = new Date()): Promise<Hub> {
  const scope = requireRole(account, ["TECH_ADMIN"]);
  const details = HubReviewInput.parse(input);
  const repository = getRepository();
  const hub = await repository.get("Hub", details.hubId);
  if (!hub) throw new Error("Hub not found");
  const result = reviewHub(hub, { actorId: scope.userId, actorRole: scope.role, decision: details.decision, reason: details.reason, now });
  await repository.put("Hub", result.hub);
  await repository.put("HubVerification", result.verification);
  return result.hub;
}
