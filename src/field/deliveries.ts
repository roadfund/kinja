import { z } from "zod";
import { createUuidV7 } from "@/domain/id";
import { amountForWeight } from "@/domain/money";
import type { Crop, Delivery, HubCrop } from "@/domain/model";
import { getRepository } from "@/repositories/server";

export const DeliveryInput = z.object({
  farmerId: z.string().min(1),
  plotId: z.string().min(1).optional(),
  cropId: z.string().min(1),
  gradeId: z.string().min(1),
  kilograms: z.string().trim().regex(/^\d+(\.\d{1,3})?$/, "Enter the weight in kg with up to 3 decimals").refine((value) => Number(value) > 0, "Weight must be more than 0 kg"),
  rejectionReason: z.string().trim().min(1).optional(),
});
export type DeliveryInput = z.infer<typeof DeliveryInput>;

export type CropOption = { cropId: string; name: string; currency: string; grades: HubCrop["grades"] };

// The crops a hub has enabled, with their grades and current prices.
export async function listHubCropOptions(hubId: string): Promise<CropOption[]> {
  const repository = getRepository();
  const crops = new Map((await repository.list("Crop")).map((crop: Crop) => [crop.id, crop.name]));
  return (await repository.list("HubCrop", hubId))
    .filter((hubCrop) => hubCrop.enabled && hubCrop.grades.length > 0)
    .map((hubCrop) => ({ cropId: hubCrop.cropId, name: crops.get(hubCrop.cropId) ?? hubCrop.cropId, currency: hubCrop.grades[0].currency, grades: hubCrop.grades }));
}

// Prices are copied onto the delivery at the moment it is recorded, so later
// price changes never alter what a farmer is owed for past deliveries.
// Devices send their own id, and the price they showed when the delivery was recorded offline.
export async function recordDelivery(input: unknown, scope: { hubId: string; cooperativeId: string; userId: string }, now = new Date(), options: { id?: string; devicePriceMinorPerKg?: number } = {}): Promise<Delivery> {
  const details = DeliveryInput.parse(input);
  const repository = getRepository();

  const farmer = await repository.get("Farmer", details.farmerId, scope.hubId);
  if (!farmer || farmer.cooperativeId !== scope.cooperativeId) throw new Error("Farmer is not part of your cooperative");
  if (details.plotId && !farmer.plots.some((plot) => plot.id === details.plotId)) throw new Error("Plot does not belong to this farmer");

  const hubCrop = (await repository.list("HubCrop", scope.hubId)).find((item) => item.cropId === details.cropId && item.enabled);
  const grade = hubCrop?.grades.find((item) => item.gradeId === details.gradeId);
  if (!grade) throw new Error("Crop or grade is not enabled for your hub");
  const priceMinorPerKg = options.devicePriceMinorPerKg ?? grade.priceMinorPerKg;
  if (!Number.isInteger(priceMinorPerKg) || priceMinorPerKg < 0) throw new Error("Invalid price");
  if (priceMinorPerKg === 0 && !details.rejectionReason) throw new Error("Give a reason for rejected produce");

  const timestamp = now.toISOString();
  const delivery: Delivery = {
    id: options.id ?? createUuidV7(), hubId: scope.hubId, cooperativeId: scope.cooperativeId, farmerId: farmer.id, plotId: details.plotId, cropId: details.cropId,
    kilograms: details.kilograms, gradeId: grade.gradeId, priceMinorPerKg, amountOwedMinor: amountForWeight(details.kilograms, priceMinorPerKg),
    rejectionReason: details.rejectionReason, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp,
  };
  await repository.put("Delivery", delivery);
  return delivery;
}

export async function listDeliveries(hubId: string, cooperativeId: string): Promise<Delivery[]> {
  return (await getRepository().list("Delivery", hubId)).filter((delivery) => delivery.cooperativeId === cooperativeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
