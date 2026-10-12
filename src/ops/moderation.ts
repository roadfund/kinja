import { z } from "zod";
import { requireRole } from "@/auth/authorization";
import { deleteSessionsForUser, type Account } from "@/auth/server-store";
import type { AuditLog, Hub, Membership, Organization } from "@/domain/model";
import { writeAuditLog } from "@/ops/audit";
import { getRepository } from "@/repositories/server";

const Reason = z.string().trim().min(3, "Give a reason of at least 3 characters").max(500);
const ModerationInput = z.object({ suspend: z.boolean(), reason: Reason });

export const voidableEntities = ["Delivery", "Transfer", "Batch", "Sale", "Invoice", "Collection"] as const;
export type VoidableEntity = (typeof voidableEntities)[number];

function requireTechAdmin(account: Account) {
  return requireRole(account, ["TECH_ADMIN"]);
}

export type HubOverview = Hub & { organizations: number; members: number; farmers: number };

export async function listHubsForModeration(account: Account): Promise<HubOverview[]> {
  requireTechAdmin(account);
  const repository = getRepository();
  const [hubs, organizations, memberships, farmers] = await Promise.all([repository.list("Hub"), repository.list("Organization"), repository.list("Membership"), repository.list("Farmer")]);
  return hubs.map((hub) => ({ ...hub, organizations: organizations.filter((item) => item.hubId === hub.id).length, members: memberships.filter((item) => item.hubId === hub.id && item.status !== "REMOVED").length, farmers: farmers.filter((item) => item.hubId === hub.id).length })).sort((a, b) => a.businessName.localeCompare(b.businessName));
}

// Suspending a hub blocks everyone in it; reinstating returns it to verified.
export async function setHubSuspended(account: Account, hubId: string, input: unknown, now = new Date()): Promise<Hub> {
  const scope = requireTechAdmin(account);
  const { suspend, reason } = ModerationInput.parse(input);
  const hub = await getRepository().get("Hub", hubId);
  if (!hub) throw new Error("Hub not found");
  if (suspend && hub.status !== "VERIFIED") throw new Error("Only verified hubs can be suspended");
  if (!suspend && hub.status !== "SUSPENDED") throw new Error("This hub is not suspended");
  const updated: Hub = { ...hub, status: suspend ? "SUSPENDED" : "VERIFIED", updatedAt: now.toISOString() };
  await getRepository().put("Hub", updated);
  await writeAuditLog({ actorId: scope.userId, hubId, action: suspend ? "SUSPEND" : "REINSTATE", entity: "Hub", entityId: hubId, reason }, now);
  return updated;
}

export async function setOrganizationSuspended(account: Account, organizationId: string, input: unknown, now = new Date()): Promise<Organization> {
  const scope = requireTechAdmin(account);
  const { suspend, reason } = ModerationInput.parse(input);
  const organization = await getRepository().get("Organization", organizationId);
  if (!organization) throw new Error("Organization not found");
  if (suspend === Boolean(organization.suspendedAt)) throw new Error(suspend ? "This organization is already suspended" : "This organization is not suspended");
  const updated: Organization = { ...organization, suspendedAt: suspend ? now.toISOString() : undefined, suspendedById: suspend ? scope.userId : undefined, updatedAt: now.toISOString() };
  await getRepository().put("Organization", updated);
  if (suspend) {
    for (const membership of await getRepository().list("Membership", organization.hubId)) if (membership.organizationId === organization.id) await deleteSessionsForUser(membership.userId);
  }
  await writeAuditLog({ actorId: scope.userId, hubId: organization.hubId, action: suspend ? "SUSPEND" : "REINSTATE", entity: "Organization", entityId: organizationId, reason }, now);
  return updated;
}

// Suspending a user ends their sessions straight away; reinstating restores access.
export async function setMemberSuspended(account: Account, membershipId: string, input: unknown, now = new Date()): Promise<Membership> {
  const scope = requireTechAdmin(account);
  const { suspend, reason } = ModerationInput.parse(input);
  const membership = await getRepository().get("Membership", membershipId);
  if (!membership || membership.status === "REMOVED") throw new Error("Member not found");
  if (membership.role === "TECH_ADMIN") throw new Error("Tech admins cannot be suspended here");
  if (suspend && membership.status !== "ACTIVE") throw new Error("This member is already suspended");
  if (!suspend && membership.status !== "SUSPENDED") throw new Error("This member is not suspended");
  const updated: Membership = { ...membership, status: suspend ? "SUSPENDED" : "ACTIVE", updatedAt: now.toISOString() };
  await getRepository().put("Membership", updated);
  if (suspend) await deleteSessionsForUser(membership.userId);
  await writeAuditLog({ actorId: scope.userId, hubId: membership.hubId, action: suspend ? "SUSPEND" : "REINSTATE", entity: "User", entityId: membership.userId, reason }, now);
  return updated;
}

const VoidInput = z.object({ reason: Reason });

// Voids keep the record (never hard-deleted) with who, when and why. Records
// something else depends on must be voided in order, so traceability never breaks.
export async function voidRecord(account: Account, entity: VoidableEntity, id: string, input: unknown, now = new Date()): Promise<void> {
  const scope = requireTechAdmin(account);
  const { reason } = VoidInput.parse(input);
  const repository = getRepository();
  const record = await repository.get(entity, id);
  if (!record) throw new Error("Record not found");
  if (record.voidedAt) throw new Error("This record is already voided");
  const hubId = record.hubId;
  const live = <T extends { voidedAt?: string }>(items: T[]) => items.filter((item) => !item.voidedAt);

  if (entity === "Delivery" && live(await repository.list("Transfer", hubId)).some((transfer) => transfer.deliveryIds.includes(id))) throw new Error("This delivery is part of a transfer. Void the transfer first.");
  if (entity === "Transfer") {
    if (live(await repository.list("Batch", hubId)).some((batch) => batch.transferIds.includes(id))) throw new Error("This raw material was used in a batch. Void the batch first.");
    const transfer = record as { kind: string; batchId?: string; toOrganizationId: string };
    if (transfer.kind === "FINISHED_GOODS" && live(await repository.list("Sale", hubId)).some((sale) => sale.batchId === transfer.batchId && sale.distributorId === transfer.toOrganizationId)) throw new Error("The distributor has sold from this shipment. Void those sales first.");
  }
  if (entity === "Batch" && live(await repository.list("Transfer", hubId)).some((transfer) => transfer.batchId === id)) throw new Error("Goods from this batch were sent to a distributor. Void those transfers first.");
  if (entity === "Sale" && (record as { invoiceId?: string }).invoiceId && live(await repository.list("Invoice", hubId)).some((invoice) => invoice.id === (record as { invoiceId?: string }).invoiceId)) throw new Error("This sale is on an invoice. Void the invoice first.");
  if (entity === "Invoice") {
    if (live(await repository.list("Collection", hubId)).some((collection) => collection.invoiceId === id)) throw new Error("Payments were collected on this invoice. Void the collections first.");
    // Release the sales so they can be invoiced again.
    for (const sale of await repository.list("Sale", hubId)) if (sale.invoiceId === id) await repository.put("Sale", { ...sale, invoiceId: undefined, updatedAt: now.toISOString() });
  }

  const voided = { ...record, voidedAt: now.toISOString(), voidedById: scope.userId, voidReason: reason, updatedAt: now.toISOString() };
  await repository.put(entity, voided as never);
  await writeAuditLog({ actorId: scope.userId, hubId, action: "VOID", entity, entityId: id, reason }, now);
}

export type AuditRow = AuditLog & { actorName: string; hubName?: string };

export async function listAuditLog(account: Account, hubId?: string): Promise<AuditRow[]> {
  requireTechAdmin(account);
  const repository = getRepository();
  const [entries, users, hubs] = await Promise.all([repository.list("AuditLog"), repository.list("User"), repository.list("Hub")]);
  return entries.filter((entry) => !hubId || entry.hubId === hubId).map((entry) => ({ ...entry, actorName: users.find((user) => user.id === entry.createdById)?.fullName ?? "Unknown", hubName: hubs.find((hub) => hub.id === entry.hubId)?.businessName })).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
