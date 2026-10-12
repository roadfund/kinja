import { isValidPhone, normalizePhone } from "@/config/phone";
import { createUuidV7 } from "@/domain/id";
import { FarmerDetails, type Farmer } from "@/domain/model";
import { getRepository } from "@/repositories/server";

export const FarmerInput = FarmerDetails;
export type { Farmer };
type CooperativeRef = { hubId: string; cooperativeId: string };
type WriteScope = CooperativeRef & { userId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Phone and mobile money numbers are optional, stored in international format,
// and must match the hub's country format when given.
async function prepareDetails(input: unknown, hubId: string) {
  const details = FarmerInput.parse(input);
  const countryId = (await getRepository().get("Hub", hubId))?.countryId ?? "lr";
  const phone = (raw: string | undefined, label: string) => {
    if (!raw) return undefined;
    const normalized = normalizePhone(raw, countryId);
    if (!isValidPhone(normalized, countryId)) throw new Error(`${label} is not a valid number for this country`);
    return normalized;
  };
  return { ...details, phone: phone(details.phone, "Phone"), mobileMoneyNumber: phone(details.mobileMoneyNumber, "Mobile money number") };
}

// Registers a farmer. Devices send their own ids (UUIDv7) so records never need re-keying when they sync.
export async function registerFarmer(input: unknown, scope: WriteScope, now = new Date(), options: { id?: string; possibleDuplicateOf?: string[] } = {}): Promise<Farmer> {
  const details = await prepareDetails(input, scope.hubId);
  if (options.id && !UUID.test(options.id)) throw new Error("Invalid record id");
  const plotIds = new Set<string>();
  const plots = details.plots.map((plot) => {
    const id = plot.id && UUID.test(plot.id) && !plotIds.has(plot.id) ? plot.id : createUuidV7();
    plotIds.add(id);
    return { ...plot, id };
  });
  const timestamp = now.toISOString();
  const farmer: Farmer = { ...details, plots, id: options.id ?? createUuidV7(), hubId: scope.hubId, cooperativeId: scope.cooperativeId, possibleDuplicateOf: options.possibleDuplicateOf?.length ? options.possibleDuplicateOf : undefined, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("Farmer", farmer);
  return farmer;
}

export async function listFarmers(hubId: string, cooperativeId: string): Promise<Farmer[]> {
  return (await getRepository().list("Farmer", hubId)).filter((farmer) => farmer.cooperativeId === cooperativeId);
}

// Returns null for farmers in other hubs or cooperatives, so callers cannot tell them apart from missing ones.
export async function getFarmer(farmerId: string, scope: CooperativeRef): Promise<Farmer | null> {
  const farmer = await getRepository().get("Farmer", farmerId, scope.hubId);
  return farmer?.cooperativeId === scope.cooperativeId ? farmer : null;
}

export async function updateFarmer(farmerId: string, input: unknown, scope: WriteScope, now = new Date()): Promise<Farmer> {
  const existing = await getFarmer(farmerId, scope);
  if (!existing) throw new Error("Farmer not found");
  const details = await prepareDetails(input, scope.hubId);

  // Plots keep their ids so deliveries stay linked; unknown ids are treated as new plots.
  const existingPlotIds = new Set(existing.plots.map((plot) => plot.id));
  const plots = details.plots.map((plot) => ({ ...plot, id: plot.id && (existingPlotIds.has(plot.id) || UUID.test(plot.id)) ? plot.id : createUuidV7() }));
  const keptPlotIds = new Set(plots.map((plot) => plot.id));
  const removedPlotIds = [...existingPlotIds].filter((id) => id && !keptPlotIds.has(id));
  if (removedPlotIds.length) {
    const deliveries = await getRepository().list("Delivery", scope.hubId);
    if (deliveries.some((delivery) => !delivery.voidedAt && delivery.plotId && removedPlotIds.includes(delivery.plotId))) throw new Error("A plot with recorded deliveries cannot be removed");
  }

  const farmer: Farmer = { ...existing, ...details, photoUrl: details.photoUrl, phone: details.phone, mobileMoneyNumber: details.mobileMoneyNumber, householdSize: details.householdSize, dependents: details.dependents, headOfHousehold: details.headOfHousehold, dateOfBirth: details.dateOfBirth, plots, updatedAt: now.toISOString() };
  await getRepository().put("Farmer", farmer);
  return farmer;
}

export type PhoneMatch = { id: string; fullName: string; sameCooperative: boolean };

// Other farmers in the hub with the same phone. Used to warn, never to block.
export async function findFarmersWithPhone(hubId: string, cooperativeId: string, rawPhone: string, excludeFarmerId?: string): Promise<PhoneMatch[]> {
  const countryId = (await getRepository().get("Hub", hubId))?.countryId ?? "lr";
  const phone = normalizePhone(rawPhone, countryId);
  if (!phone) return [];
  return (await getRepository().list("Farmer", hubId))
    .filter((farmer) => farmer.id !== excludeFarmerId && farmer.phone === phone)
    .map((farmer) => ({ id: farmer.id, fullName: farmer.cooperativeId === cooperativeId ? farmer.fullName : "A farmer in another cooperative", sameCooperative: farmer.cooperativeId === cooperativeId }));
}

// The coop lead confirms a flagged farmer is a different person.
export async function dismissDuplicateFlag(farmerId: string, scope: WriteScope, now = new Date()): Promise<Farmer> {
  const farmer = await getFarmer(farmerId, scope);
  if (!farmer) throw new Error("Farmer not found");
  const updated: Farmer = { ...farmer, possibleDuplicateOf: undefined, updatedAt: now.toISOString() };
  await getRepository().put("Farmer", updated);
  return updated;
}
