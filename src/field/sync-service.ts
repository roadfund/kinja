import { z, ZodError } from "zod";
import { AuthorizationError, requireCooperativeScope } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import type { Farmer } from "@/domain/model";
import { listHubCropOptions, recordDelivery, type CropOption } from "@/field/deliveries";
import { FarmerInput, findFarmersWithPhone, getFarmer, listFarmers, registerFarmer, updateFarmer } from "@/field/farmers";
import { writeAuditLog } from "@/ops/audit";
import { getRepository } from "@/repositories/server";

const RecordId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid record id");
const base = { opId: z.string().min(1).max(100), recordId: RecordId, recordedAt: z.string().datetime() };

export const SyncItem = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("CREATE_FARMER"), payload: z.unknown() }),
  z.object({ ...base, kind: z.literal("UPDATE_FARMER"), payload: z.unknown() }),
  z.object({ ...base, kind: z.literal("RECORD_DELIVERY"), payload: z.unknown(), devicePriceMinorPerKg: z.number().int().nonnegative() }),
]);
export type SyncItem = z.infer<typeof SyncItem>;
export const SyncBatch = z.object({ items: z.array(SyncItem).min(1).max(50) });

export type SyncResult = { opId: string; recordId: string; status: "APPLIED" | "ALREADY_APPLIED" | "SUPERSEDED" | "REJECTED"; message?: string; warnings?: string[] };

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

// A device clock can be wrong; never accept a time in the future.
function recordedTime(recordedAt: string, now: Date): Date {
  const time = new Date(recordedAt);
  return time.getTime() > now.getTime() + FUTURE_TOLERANCE_MS ? now : time;
}

// Farmers already in the cooperative who look like the same person (same phone,
// or same name in the same community). Flagged for review, never merged.
function possibleDuplicates(existing: Farmer[], candidate: { fullName: string; community: string; phone?: string }): string[] {
  return existing.filter((farmer) => (candidate.phone && farmer.phone === candidate.phone) || (normalize(farmer.fullName) === normalize(candidate.fullName) && normalize(farmer.community) === normalize(candidate.community))).map((farmer) => farmer.id);
}

// Applies queued Kinja Field writes from a device, in order. Sending the same
// item twice is safe: records are keyed by the id the device generated.
export async function applySyncBatch(account: Account, input: unknown, now = new Date()): Promise<SyncResult[]> {
  const scope = requireCooperativeScope(account);
  const writeScope = { hubId: scope.hubId, cooperativeId: scope.organizationId, userId: scope.userId };
  const { items } = SyncBatch.parse(input);
  const repository = getRepository();
  const results: SyncResult[] = [];

  for (const item of items) {
    const at = recordedTime(item.recordedAt, now);
    try {
      if (item.kind === "CREATE_FARMER") {
        const existing = await repository.get("Farmer", item.recordId);
        if (existing) {
          results.push(existing.hubId === scope.hubId && existing.cooperativeId === scope.organizationId ? { opId: item.opId, recordId: item.recordId, status: "ALREADY_APPLIED" } : { opId: item.opId, recordId: item.recordId, status: "REJECTED", message: "This record id is already in use" });
          continue;
        }
        const details = FarmerInput.parse(item.payload);
        const farmer = await registerFarmer(details, writeScope, at, { id: item.recordId });
        const duplicates = possibleDuplicates((await listFarmers(scope.hubId, scope.organizationId)).filter((other) => other.id !== farmer.id), farmer);
        if (duplicates.length) await repository.put("Farmer", { ...farmer, possibleDuplicateOf: duplicates });
        const warnings = [];
        if (duplicates.length) warnings.push("This farmer may already be registered. Your coop lead will review it.");
        if (farmer.phone && (await findFarmersWithPhone(scope.hubId, scope.organizationId, farmer.phone, farmer.id)).length) warnings.push("This phone number is already used by another farmer in your hub.");
        results.push({ opId: item.opId, recordId: item.recordId, status: "APPLIED", warnings });
      } else if (item.kind === "UPDATE_FARMER") {
        const existing = await getFarmer(item.recordId, writeScope);
        if (!existing) throw new Error("Farmer not found");
        // Last write wins by the time the edit was made on the device. Every version is kept in the audit log.
        if (at.toISOString() < existing.updatedAt) {
          await writeAuditLog({ actorId: scope.userId, hubId: scope.hubId, action: "UPDATE_SUPERSEDED", entity: "Farmer", entityId: existing.id, reason: "A newer edit was already saved", snapshot: item.payload }, now);
          results.push({ opId: item.opId, recordId: item.recordId, status: "SUPERSEDED", message: "A newer edit of this farmer was already saved. Your version is kept in the history." });
          continue;
        }
        await writeAuditLog({ actorId: scope.userId, hubId: scope.hubId, action: "UPDATE", entity: "Farmer", entityId: existing.id, snapshot: existing }, now);
        await updateFarmer(item.recordId, item.payload, writeScope, at);
        results.push({ opId: item.opId, recordId: item.recordId, status: "APPLIED" });
      } else {
        const existing = await repository.get("Delivery", item.recordId);
        if (existing) {
          results.push(existing.hubId === scope.hubId && existing.cooperativeId === scope.organizationId ? { opId: item.opId, recordId: item.recordId, status: "ALREADY_APPLIED" } : { opId: item.opId, recordId: item.recordId, status: "REJECTED", message: "This record id is already in use" });
          continue;
        }
        const delivery = await recordDelivery(item.payload, writeScope, at, { id: item.recordId, devicePriceMinorPerKg: item.devicePriceMinorPerKg });
        const current = (await listHubCropOptions(scope.hubId)).find((crop) => crop.cropId === delivery.cropId)?.grades.find((grade) => grade.gradeId === delivery.gradeId)?.priceMinorPerKg;
        if (current !== undefined && current !== delivery.priceMinorPerKg) await writeAuditLog({ actorId: scope.userId, hubId: scope.hubId, action: "DEVICE_PRICE", entity: "Delivery", entityId: delivery.id, reason: `Recorded with the price on the device (${delivery.priceMinorPerKg}); the hub price is now ${current}` }, now);
        results.push({ opId: item.opId, recordId: item.recordId, status: "APPLIED" });
      }
    } catch (error) {
      if (error instanceof AuthorizationError) throw error;
      const message = error instanceof ZodError ? `Some details are invalid (${error.issues[0]?.path.join(".") || "record"}): ${error.issues[0]?.message}` : error instanceof Error ? error.message : "Could not save this record";
      results.push({ opId: item.opId, recordId: item.recordId, status: "REJECTED", message });
    }
  }
  return results;
}

export type OfflinePack = {
  generatedAt: string;
  userId: string;
  cooperative: { id: string; name: string };
  currency: string;
  crops: CropOption[];
  farmers: Array<{ id: string; fullName: string; phone?: string; community: string; plots: Array<{ id: string; description: string }>; updatedAt: string }>;
};

// What a device caches so field work can continue offline.
export async function buildOfflinePack(account: Account, now = new Date()): Promise<OfflinePack> {
  const scope = requireCooperativeScope(account);
  const [crops, farmers] = await Promise.all([listHubCropOptions(scope.hubId), listFarmers(scope.hubId, scope.organizationId)]);
  return {
    generatedAt: now.toISOString(),
    userId: scope.userId,
    cooperative: { id: scope.organizationId, name: account.organization!.name },
    currency: crops[0]?.currency ?? "LRD",
    crops,
    farmers: farmers.map((farmer) => ({ id: farmer.id, fullName: farmer.fullName, phone: farmer.phone, community: farmer.community, plots: farmer.plots.flatMap((plot) => (plot.id ? [{ id: plot.id, description: plot.description }] : [])), updatedAt: farmer.updatedAt })).sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
}
