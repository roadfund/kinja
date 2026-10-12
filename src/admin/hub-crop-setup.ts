import { z } from "zod";
import { requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { createUuidV7 } from "@/domain/id";
import type { HubCrop } from "@/domain/model";
import { hubCurrency } from "@/market/market-service";
import { getRepository } from "@/repositories/server";

export type CropSetupRow = { cropId: string; name: string; enabled: boolean; grades: HubCrop["grades"]; usedGradeIds: string[]; updatedAt?: string };

// Every active crop on the master list, with this hub's grades and prices if it has set any.
export async function getCropSetup(account: Account): Promise<{ currency: string; crops: CropSetupRow[] }> {
  const scope = requireRole(account, ["HUB_ADMIN"]);
  const repository = getRepository();
  const [crops, hubCrops, deliveries] = await Promise.all([repository.list("Crop"), repository.list("HubCrop", scope.hubId), repository.list("Delivery", scope.hubId)]);
  return {
    currency: hubCurrency(account.hub!),
    crops: crops.filter((crop) => crop.status === "ACTIVE").sort((a, b) => a.name.localeCompare(b.name)).map((crop) => {
      const hubCrop = hubCrops.find((item) => item.cropId === crop.id);
      return { cropId: crop.id, name: crop.name, enabled: hubCrop?.enabled ?? false, grades: hubCrop?.grades ?? [], usedGradeIds: [...new Set(deliveries.filter((delivery) => delivery.cropId === crop.id).map((delivery) => delivery.gradeId))], updatedAt: hubCrop?.updatedAt };
    }),
  };
}

export const CropSetupInput = z.object({
  cropId: z.string().min(1),
  enabled: z.boolean(),
  grades: z.array(z.object({
    gradeId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(40),
    priceMinorPerKg: z.number().int().nonnegative("Prices must be whole minor units"),
  })).max(10),
});

// Hub admins configure crops even while the hub is pending verification.
// Grades keep their ids, so past deliveries keep their grade names.
export async function saveCropSetup(account: Account, input: unknown, now = new Date()): Promise<HubCrop> {
  const scope = requireRole(account, ["HUB_ADMIN"]);
  const details = CropSetupInput.parse(input);
  const repository = getRepository();
  const crop = await repository.get("Crop", details.cropId);
  if (!crop || crop.status !== "ACTIVE") throw new Error("Choose a crop from the master list");
  if (details.enabled && details.grades.length === 0) throw new Error("Add at least one grade before enabling this crop");
  const names = details.grades.map((grade) => grade.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Each grade needs a different name");

  const existing = (await repository.list("HubCrop", scope.hubId)).find((item) => item.cropId === crop.id);
  const keptIds = new Set(details.grades.map((grade) => grade.gradeId).filter(Boolean));
  const removed = (existing?.grades ?? []).filter((grade) => !keptIds.has(grade.gradeId));
  if (removed.length) {
    const deliveries = await repository.list("Delivery", scope.hubId);
    const used = removed.find((grade) => deliveries.some((delivery) => delivery.cropId === crop.id && delivery.gradeId === grade.gradeId));
    if (used) throw new Error(`${used.name} is used by recorded deliveries. Rename it or change its price instead of removing it.`);
  }

  const currency = hubCurrency(account.hub!);
  const knownIds = new Set((existing?.grades ?? []).map((grade) => grade.gradeId));
  const timestamp = now.toISOString();
  const hubCrop: HubCrop = {
    id: existing?.id ?? createUuidV7(),
    hubId: scope.hubId,
    cropId: crop.id,
    enabled: details.enabled,
    grades: details.grades.map((grade) => ({ gradeId: grade.gradeId && knownIds.has(grade.gradeId) ? grade.gradeId : createUuidV7(), name: grade.name, priceMinorPerKg: grade.priceMinorPerKg, currency })),
    createdById: existing?.createdById ?? scope.userId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await repository.put("HubCrop", hubCrop);
  return hubCrop;
}
