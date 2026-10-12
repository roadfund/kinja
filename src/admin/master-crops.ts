import { z } from "zod";
import { requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import type { Crop } from "@/domain/model";
import { writeAuditLog } from "@/ops/audit";
import { getRepository } from "@/repositories/server";

// The master crop list, owned by the tech admin. Hubs enable crops from it in hub setup
// and set their own grades and prices; there are no free-text crop names anywhere else.
// Crops are archived, never deleted, so past deliveries keep their crop.

export type MasterCropRow = Crop & { hubsUsing: number };

export async function listMasterCrops(account: Account): Promise<MasterCropRow[]> {
  requireRole(account, ["TECH_ADMIN"]);
  const [crops, hubCrops] = await Promise.all([getRepository().list("Crop"), getRepository().list("HubCrop")]);
  return crops.map((crop) => ({ ...crop, hubsUsing: hubCrops.filter((hubCrop) => hubCrop.cropId === crop.id && hubCrop.enabled).length })).sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
}

export const MasterCropInput = z.object({ name: z.string().trim().min(2, "Enter the crop name").max(60) });

// "Sweet potato" -> "sweet-potato": readable ids that stay stable.
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function addMasterCrop(account: Account, input: unknown, now = new Date()): Promise<Crop> {
  const scope = requireRole(account, ["TECH_ADMIN"]);
  const { name } = MasterCropInput.parse(input);
  const id = slug(name);
  if (!id) throw new Error("Enter the crop name");
  const existing = await getRepository().get("Crop", id);
  if (existing) throw new Error(existing.status === "ARCHIVED" ? `${existing.name} is archived. Restore it instead.` : `${existing.name} is already on the list`);
  const timestamp = now.toISOString();
  const crop: Crop = { id, name, status: "ACTIVE", createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("Crop", crop);
  await writeAuditLog({ actorId: scope.userId, action: "ADD_CROP", entity: "Crop", entityId: id, reason: name }, now);
  return crop;
}

// Archived crops disappear from hub setup and new farmer and delivery forms; old records keep them.
export async function setMasterCropArchived(account: Account, cropId: string, archived: boolean, now = new Date()): Promise<Crop> {
  const scope = requireRole(account, ["TECH_ADMIN"]);
  const crop = await getRepository().get("Crop", cropId);
  if (!crop) throw new Error("Crop not found");
  const updated: Crop = { ...crop, status: archived ? "ARCHIVED" : "ACTIVE", updatedAt: now.toISOString() };
  await getRepository().put("Crop", updated);
  await writeAuditLog({ actorId: scope.userId, action: archived ? "ARCHIVE_CROP" : "RESTORE_CROP", entity: "Crop", entityId: crop.id, reason: crop.name }, now);
  return updated;
}
