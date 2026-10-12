import { createUserWithMembership, loadAccount, PLATFORM_HUB_ID, type Account } from "@/auth/server-store";
import { createBatch, createFinishedGoodsTransfer, createRawMaterialTransfer, receiveTransfer } from "@/manufacture/manufacture-service";
import { createInvoice, recordCollection, saveCustomer } from "@/market/market-service";
import { cancelOrder, createOrder, hubToday } from "@/market/orders";
import { recordDelivery } from "@/field/deliveries";
import { registerFarmer } from "@/field/farmers";
import type { Hub, HubCrop, Invite, Membership } from "@/domain/model";
import { getRepository, isFreshDataStore } from "@/repositories/server";

// Demo data for development. Usernames and passwords come from .env.local when
// set, so the same credentials keep working after a reset.
const DEFAULT_PASSWORD = "kinja-dev-password";
const audit = (now: Date) => ({ createdById: "system", createdAt: now.toISOString(), updatedAt: now.toISOString() });

export const seedIds = { verifiedHub: "seed-hub-jimmys-group", pendingHub: "seed-hub-sunrise-agro", cooperative: "seed-org-gbarnga-coop", manufacturer: "seed-org-bong-processors", distributor: "seed-org-monrovia-fresh" };

function credentials(envPrefix: string, fallbackUsername: string) {
  return { username: process.env[`${envPrefix}_USERNAME`] || fallbackUsername, password: process.env[`${envPrefix}_PASSWORD`] || DEFAULT_PASSWORD };
}

function hub(id: string, businessName: string, status: Hub["status"], regionOrCounty: string, contactName: string, now: Date): Hub {
  return { id, countryId: "lr", businessName, status, regionOrCounty, physicalAddress: `${regionOrCounty} County`, businessCategory: "Cooperative", yearEstablished: 2019, businessRegistrationNumber: `REG-${id.slice(-6).toUpperCase()}`, registrationCertificateUrl: "seed-certificate.pdf", contactPerson: { fullName: contactName, title: "Director", phone: "+231770000100", email: "contact@example.com" }, mainCropIds: ["cassava", "sweet-potato"], approximateFarmerCount: 120, approximateCooperativeCount: 3, ...audit(now) };
}

export async function clearAllData(): Promise<void> {
  await getRepository().clear();
}

// withSampleSales: false keeps the supply chain but leaves Kinja Market empty, for importing real sales history.
export async function loadSeedData({ withValueChain = true, withSampleSales = true, now = new Date() }: { withValueChain?: boolean; withSampleSales?: boolean; now?: Date } = {}): Promise<void> {
  const repository = getRepository();
  // Keep people signed in across a reload: seeded users have fixed ids, so their sessions stay valid.
  const sessions = await repository.list("Session");
  await clearAllData();

  for (const [id, name] of [["cassava", "Cassava"], ["sweet-potato", "Sweet potato"], ["plantain", "Plantain"], ["rice", "Rice"]]) await repository.put("Crop", { id, name, status: "ACTIVE", ...audit(now) });

  // Liberia uses LRD and USD. The rate starts well before any seeded record, so all of them convert.
  await repository.put("ExchangeRate", { id: "seed-rate-lr-usd", countryId: "lr", currency: "USD", rateTenThousandths: 1_900_000, effectiveFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(), ...audit(now) });
  await repository.put("Hub", hub(seedIds.verifiedHub, "Jimmy's Group", "VERIFIED", "Bong", "Jimmy Kpadeh", now));
  await repository.put("Hub", hub(seedIds.pendingHub, "Sunrise Agro", "PENDING_VERIFICATION", "Nimba", "Comfort Gaye", now));
  await repository.put("Organization", { id: seedIds.cooperative, hubId: seedIds.verifiedHub, name: "Gbarnga Farmers Cooperative", type: "COOPERATIVE", ...audit(now) });
  await repository.put("Organization", { id: seedIds.manufacturer, hubId: seedIds.verifiedHub, name: "Bong Cassava Processors", type: "MANUFACTURER", ...audit(now) });
  await repository.put("Organization", { id: seedIds.distributor, hubId: seedIds.verifiedHub, name: "Monrovia Fresh Foods", type: "DISTRIBUTOR", ...audit(now) });

  const prices: Array<[string, boolean, number, number]> = [["cassava", true, 650, 500], ["sweet-potato", true, 700, 550], ["plantain", true, 800, 600], ["rice", false, 1200, 900]];
  for (const [cropId, enabled, gradeA, gradeB] of prices) {
    const hubCrop: HubCrop = { id: `seed-hub-crop-${cropId}`, hubId: seedIds.verifiedHub, cropId, enabled, grades: [{ gradeId: "a", name: "Grade A", priceMinorPerKg: gradeA, currency: "LRD" }, { gradeId: "b", name: "Grade B", priceMinorPerKg: gradeB, currency: "LRD" }, { gradeId: "rejected", name: "Rejected", priceMinorPerKg: 0, currency: "LRD" }], ...audit(now) };
    await repository.put("HubCrop", hubCrop);
  }

  const people: Array<{ envPrefix: string; fallback: string; fullName: string; role: Membership["role"]; hubId: string; organizationId?: string; id?: string }> = [
    { envPrefix: "TECH_ADMIN", fallback: "techadmin", fullName: "Kinja Tech Admin", role: "TECH_ADMIN", hubId: PLATFORM_HUB_ID, id: "tech-admin" },
    { envPrefix: "HUB_ADMIN", fallback: "hubadmin", fullName: "Jimmy Kpadeh", role: "HUB_ADMIN", hubId: seedIds.verifiedHub },
    { envPrefix: "PENDING_HUB_ADMIN", fallback: "pendingadmin", fullName: "Comfort Gaye", role: "HUB_ADMIN", hubId: seedIds.pendingHub },
    { envPrefix: "COOP_LEAD", fallback: "cooplead", fullName: "Musu Kollie", role: "COOP_LEAD", hubId: seedIds.verifiedHub, organizationId: seedIds.cooperative },
    { envPrefix: "FIELD_STAFF", fallback: "fieldstaff", fullName: "Emmanuel Flomo", role: "FIELD_STAFF", hubId: seedIds.verifiedHub, organizationId: seedIds.cooperative },
    { envPrefix: "MANUFACTURER", fallback: "manufacturer", fullName: "Fatu Kamara", role: "MANUFACTURER", hubId: seedIds.verifiedHub, organizationId: seedIds.manufacturer },
    { envPrefix: "DISTRIBUTOR", fallback: "distributor", fullName: "Joseph Toe", role: "DISTRIBUTOR", hubId: seedIds.verifiedHub, organizationId: seedIds.distributor },
  ];
  let coopLeadId = "";
  let hubAdminId = "";
  const userIds: Partial<Record<Membership["role"], string>> = {};
  for (const person of people) {
    const { username, password } = credentials(person.envPrefix, person.fallback);
    const user = await createUserWithMembership({ id: person.id ?? `seed-user-${person.fallback}`, fullName: person.fullName, username, phone: "+231770000200", email: `${username.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@example.com`, password, role: person.role, hubId: person.hubId, organizationId: person.organizationId }, now);
    if (person.role === "COOP_LEAD") coopLeadId = user.id;
    if (person.envPrefix === "HUB_ADMIN") hubAdminId = user.id;
    if (person.hubId === seedIds.verifiedHub) userIds[person.role] = user.id;
  }

  // Sample invites in each state, so the Team section has history to show.
  const day = 24 * 60 * 60 * 1000;
  const invites: Array<Omit<Invite, "createdById" | "createdAt" | "updatedAt" | "hubId" | "uses"> & { uses?: number; daysAgo: number }> = [
    { id: "seed-invite-active", code: "JIMMYS-COOP-01", role: "COOP_LEAD", organizationName: "Salala Women's Cooperative", invitedById: hubAdminId, email: "salala.lead@example.com", maxUses: 1, expiresAt: new Date(now.getTime() + 6 * day).toISOString(), daysAgo: 1 },
    { id: "seed-invite-expired", code: "JIMMYS-MFR-OLD", role: "MANUFACTURER", organizationId: seedIds.manufacturer, invitedById: hubAdminId, email: "old.plant@example.com", maxUses: 1, expiresAt: new Date(now.getTime() - 3 * day).toISOString(), daysAgo: 10 },
    { id: "seed-invite-revoked", code: "JIMMYS-DIST-RV", role: "DISTRIBUTOR", organizationId: seedIds.distributor, invitedById: hubAdminId, maxUses: 1, expiresAt: new Date(now.getTime() + 4 * day).toISOString(), revokedAt: new Date(now.getTime() - day).toISOString(), revokedById: hubAdminId, daysAgo: 3 },
    { id: "seed-invite-staff", code: "GBARNGA-STAFF", role: "FIELD_STAFF", organizationId: seedIds.cooperative, invitedById: coopLeadId, maxUses: 25, uses: 1, expiresAt: new Date(now.getTime() + 5 * day).toISOString(), daysAgo: 2 },
  ];
  for (const { daysAgo, uses = 0, ...invite } of invites) {
    const createdAt = new Date(now.getTime() - daysAgo * day).toISOString();
    await repository.put("Invite", { ...invite, hubId: seedIds.verifiedHub, uses, createdById: invite.invitedById, createdAt, updatedAt: createdAt });
  }

  const scope = { hubId: seedIds.verifiedHub, cooperativeId: seedIds.cooperative, userId: coopLeadId };
  const farmers = [
    { fullName: "Mariama Kromah", gender: "FEMALE", age: 42, community: "Gbarnga", crop: "Cassava", status: "ALREADY_GROWS", size: 2.5 },
    { fullName: "Yassah Mulbah", gender: "FEMALE", age: 35, community: "Salala", crop: "Sweet potato", status: "CURRENTLY_GROWING", size: 1.5 },
    { fullName: "Prince Wollie", gender: "MALE", age: 51, community: "Totota", crop: "Cassava", status: "ALREADY_GROWS", size: 4 },
    { fullName: "Hawa Sumo", gender: "FEMALE", age: 29, community: "Gbarnga", crop: "Plantain", status: "ALREADY_GROWS", size: 1 },
  ];
  const registeredAt = new Date(now.getTime() - 50 * day);
  for (const [index, item] of farmers.entries()) {
    const farmer = await registerFarmer({ fullName: item.fullName, gender: item.gender, age: item.age, community: item.community, phone: `+23177000030${index}`, topCrops: [{ crop: item.crop, status: item.status }], plots: [{ description: "Home plot", village: item.community, size: item.size, unit: "ACRES", tenure: "OWNED", crops: [item.crop] }], incomeSource: "Farming only" }, scope, registeredAt);
    const cropId = item.crop.toLowerCase().replace(" ", "-");
    await recordDelivery({ farmerId: farmer.id, plotId: farmer.plots[0].id, cropId, gradeId: index % 2 ? "b" : "a", kilograms: `${(index + 2) * 12.5}` }, scope, registeredAt);
  }

  if (withValueChain) await seedValueChain(userIds, now, withSampleSales);
  const userIdsAfter = new Set((await repository.list("User")).map((user) => user.id));
  for (const session of sessions) if (userIdsAfter.has(session.userId)) await repository.put("Session", session);
}

// On a fresh checkout in development, load demo data so every role can sign in.
// Runs at most once per server process, even when several requests arrive together.
const runtime = globalThis as typeof globalThis & { __kinjaFreshSeed?: Promise<void> };

export function seedIfFresh(): Promise<void> {
  if (process.env.NODE_ENV === "production") return Promise.resolve();
  runtime.__kinjaFreshSeed ??= (async () => {
    if (isFreshDataStore() && (await getRepository().list("User")).length === 0) await loadSeedData();
  })();
  return runtime.__kinjaFreshSeed;
}

// A full chain for demos and reports: deliveries -> raw transfer (with a
// discrepancy) -> batch -> finished goods -> customers, sales, invoices, collections.
async function seedValueChain(userIds: Partial<Record<Membership["role"], string>>, now: Date, withSampleSales: boolean): Promise<void> {
  const account = async (role: Membership["role"]): Promise<Account> => (await loadAccount(userIds[role]!))!;
  const [coopLead, manufacturer, distributor] = await Promise.all([account("COOP_LEAD"), account("MANUFACTURER"), account("DISTRIBUTOR")]);
  const day = 24 * 60 * 60 * 1000;
  const ago = (days: number) => new Date(now.getTime() - days * day);

  const cassava = (await getRepository().list("Delivery", seedIds.verifiedHub)).filter((delivery) => delivery.cropId === "cassava");
  const raw = await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds: cassava.map((delivery) => delivery.id), quantitySent: "75", note: "Truck LR-2041" }, ago(45));
  await receiveTransfer(manufacturer, raw.id, { quantityReceived: "72.5", note: "Two bags were damp" }, ago(44));
  const batch = await createBatch(manufacturer, { newProductName: "Gari", newProductUnit: "KG", transferIds: [raw.id], quantityProduced: "29", wastageKg: "8" }, ago(42));
  const finished = await createFinishedGoodsTransfer(manufacturer, { toOrganizationId: seedIds.distributor, batchId: batch.id, quantitySent: "28" }, ago(41));
  await receiveTransfer(distributor, finished.id, { quantityReceived: "28" }, ago(40));
  if (!withSampleSales) return;

  const redLight = await saveCustomer(distributor, null, { name: "Red Light Market Stall 4", phone: "+231770004001", address: "Red Light, Paynesville", paymentTermsDays: 14 }, ago(40));
  const waterside = await saveCustomer(distributor, null, { name: "Waterside Grocers", phone: "+231770004002", email: "orders@waterside.example.com", paymentTermsDays: 30 }, ago(40));
  const supermarket = await saveCustomer(distributor, null, { name: "Paynesville Supermarket", paymentTermsDays: 7 }, ago(40));

  // Orders in every state for the sales dashboard, plus an overdue invoice, a partly paid one, and sales not yet invoiced.
  const order = (days: number, customerId: string, details: { quantity: string; price: number; category: "RETAIL" | "WHOLESALE" | "SAMPLE"; channel: "PHONE" | "WHATSAPP" | "TEAM_MEMBER" | "OFFICE_WALK_IN"; delivered?: boolean; discountBasisPoints?: number; deliveredBy?: string }) =>
    createOrder(distributor, { customerId, orderedOn: hubToday(distributor.hub!, ago(days)), category: details.category, channel: details.channel, delivered: details.delivered ?? true, deliveredBy: details.deliveredBy, discountBasisPoints: details.discountBasisPoints ?? 0, lines: [{ batchId: batch.id, quantity: details.quantity, unitPriceMinor: details.price }] }, ago(days));
  const overdue = await order(39, supermarket.id, { quantity: "4", price: 15500, category: "WHOLESALE", channel: "PHONE", deliveredBy: "Sam Kollie" });
  await createInvoice(distributor, { customerId: supermarket.id, saleIds: overdue.sales.map((sale) => sale.id) }, ago(39));
  const sample = await order(20, supermarket.id, { quantity: "1", price: 15000, category: "SAMPLE", channel: "TEAM_MEMBER", delivered: false });
  await cancelOrder(distributor, sample.order.id, { reason: "Store closed for renovation" }, ago(19));
  await order(12, waterside.id, { quantity: "3", price: 16000, category: "RETAIL", channel: "OFFICE_WALK_IN", deliveredBy: "Musu Flomo" });
  const part = await order(3, redLight.id, { quantity: "5", price: 15000, category: "WHOLESALE", channel: "TEAM_MEMBER", deliveredBy: "Sam Kollie" });
  const partInvoice = await createInvoice(distributor, { customerId: redLight.id, saleIds: part.sales.map((sale) => sale.id) }, ago(3));
  await recordCollection(distributor, partInvoice.id, { amountMinor: 30000, method: "MOBILE_MONEY", reference: "MM-58213" }, ago(1));
  await order(1, waterside.id, { quantity: "8", price: 14000, category: "WHOLESALE", channel: "PHONE", discountBasisPoints: 500, deliveredBy: "Musu Flomo" });
  await order(1, redLight.id, { quantity: "2", price: 16000, category: "RETAIL", channel: "WHATSAPP", delivered: false });
}
