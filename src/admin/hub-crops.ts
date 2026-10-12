import type { Hub, HubCrop, Role } from "@/domain/model";

export function updateHubCropPrice(hub: Hub, hubCrop: HubCrop, input: { actorRole: Role; gradeId: string; priceMinorPerKg: number }): HubCrop {
  if (input.actorRole !== "HUB_ADMIN") throw new Error("Only hub admins can configure crop prices");
  if (hubCrop.hubId !== hub.id) throw new Error("Crop configuration belongs to another hub");
  if (hub.status === "REJECTED" || hub.status === "SUSPENDED") throw new Error("Hub cannot be configured");
  if (!Number.isInteger(input.priceMinorPerKg) || input.priceMinorPerKg < 0) throw new Error("Price must be a non-negative integer in minor units");
  if (!hubCrop.grades.some((grade) => grade.gradeId === input.gradeId)) throw new Error("Grade is not enabled for this crop");

  return { ...hubCrop, grades: hubCrop.grades.map((grade) => grade.gradeId === input.gradeId ? { ...grade, priceMinorPerKg: input.priceMinorPerKg } : grade), updatedAt: new Date().toISOString() };
}