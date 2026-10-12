import { z } from "zod";
import { requireOrganizationScope, requireRole, type Scope } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { createUuidV7 } from "@/domain/id";
import { fromThousandths, toThousandths } from "@/domain/money";
import { Quantity, type Batch, type Delivery, type Organization, type OrganizationType, type Product, type ProductUnit, type Transfer } from "@/domain/model";
import { getRepository } from "@/repositories/server";

const positive = Quantity.refine((value) => toThousandths(value) > 0, "Must be more than 0");
const live = <T extends { voidedAt?: string }>(record: T) => !record.voidedAt;

export async function listOrganizations(hubId: string, type: OrganizationType): Promise<Organization[]> {
  return (await getRepository().list("Organization", hubId)).filter((organization) => organization.type === type && !organization.suspendedAt).sort((a, b) => a.name.localeCompare(b.name));
}

async function requireRecipient(hubId: string, organizationId: string, type: OrganizationType): Promise<Organization> {
  const organization = await getRepository().get("Organization", organizationId, hubId);
  if (!organization || organization.type !== type || organization.suspendedAt) throw new Error(`Choose an active ${type.toLowerCase()} in your hub`);
  return organization;
}

// ---- Transfers -------------------------------------------------------------

export type TransferRow = Transfer & { fromName: string; toName: string; itemName: string; direction: "IN" | "OUT" | "HUB" };

// Hub admins see every transfer in the hub; organizations see what they sent or received.
export async function listTransfers(account: Account): Promise<{ scope: Scope; transfers: TransferRow[] }> {
  const scope = requireRole(account, ["HUB_ADMIN", "COOP_LEAD", "MANUFACTURER", "DISTRIBUTOR"]);
  const repository = getRepository();
  const [transfers, organizations, crops, products, batches] = await Promise.all([repository.list("Transfer", scope.hubId), repository.list("Organization", scope.hubId), repository.list("Crop"), repository.list("Product", scope.hubId), repository.list("Batch", scope.hubId)]);
  const orgName = (id: string) => organizations.find((organization) => organization.id === id)?.name ?? "Unknown";
  const rows = transfers
    .filter((transfer) => scope.role === "HUB_ADMIN" || transfer.fromOrganizationId === scope.organizationId || transfer.toOrganizationId === scope.organizationId)
    .map((transfer): TransferRow => {
      const batch = batches.find((item) => item.id === transfer.batchId);
      const itemName = transfer.kind === "RAW_MATERIAL" ? crops.find((crop) => crop.id === transfer.cropId)?.name ?? "Crop" : `${products.find((product) => product.id === transfer.productId)?.name ?? "Product"}${batch ? ` · ${batchLabel(batch)}` : ""}`;
      return { ...transfer, fromName: orgName(transfer.fromOrganizationId), toName: orgName(transfer.toOrganizationId), itemName, direction: scope.role === "HUB_ADMIN" ? "HUB" : transfer.toOrganizationId === scope.organizationId ? "IN" : "OUT" };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { scope, transfers: rows };
}

// Deliveries a cooperative can still send: not voided, not rejected, not already in a transfer.
export async function listSendableDeliveries(hubId: string, cooperativeId: string): Promise<Delivery[]> {
  const repository = getRepository();
  const [deliveries, transfers] = await Promise.all([repository.list("Delivery", hubId), repository.list("Transfer", hubId)]);
  const linked = new Set(transfers.filter(live).flatMap((transfer) => transfer.deliveryIds));
  return deliveries.filter((delivery) => delivery.cooperativeId === cooperativeId && live(delivery) && delivery.priceMinorPerKg > 0 && !linked.has(delivery.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const RawTransferInput = z.object({
  toOrganizationId: z.string().min(1),
  cropId: z.string().min(1),
  deliveryIds: z.array(z.string().min(1)).min(1, "Link at least one delivery"),
  quantitySent: positive,
  note: z.string().trim().max(500).optional().transform((note) => note || undefined),
});

// Cooperative leads send raw material, linked to the deliveries it came from.
export async function createRawMaterialTransfer(account: Account, input: unknown, now = new Date()): Promise<Transfer> {
  const scope = requireOrganizationScope(account, ["COOP_LEAD"], "COOPERATIVE");
  const details = RawTransferInput.parse(input);
  await requireRecipient(scope.hubId, details.toOrganizationId, "MANUFACTURER");
  const sendable = new Map((await listSendableDeliveries(scope.hubId, scope.organizationId)).map((delivery) => [delivery.id, delivery]));
  const deliveryIds = [...new Set(details.deliveryIds)];
  for (const id of deliveryIds) {
    const delivery = sendable.get(id);
    if (!delivery) throw new Error("One of the deliveries cannot be sent: it is rejected, voided, already sent, or not from your cooperative");
    if (delivery.cropId !== details.cropId) throw new Error("All linked deliveries must be of the selected crop");
  }
  const timestamp = now.toISOString();
  const transfer: Transfer = { id: createUuidV7(), hubId: scope.hubId, kind: "RAW_MATERIAL", fromOrganizationId: scope.organizationId, toOrganizationId: details.toOrganizationId, cropId: details.cropId, deliveryIds, unit: "KG", quantitySent: details.quantitySent, status: "SENT", hasDiscrepancy: false, note: details.note, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("Transfer", transfer);
  return transfer;
}

export const ReceiveInput = z.object({ quantityReceived: Quantity, note: z.string().trim().max(500).optional().transform((note) => note || undefined) });

// Only the receiving organization confirms; a different quantity flags a discrepancy for both sides and the hub admin.
export async function receiveTransfer(account: Account, transferId: string, input: unknown, now = new Date()): Promise<Transfer> {
  const scope = requireRole(account, ["MANUFACTURER", "DISTRIBUTOR"]);
  const details = ReceiveInput.parse(input);
  const transfer = await getRepository().get("Transfer", transferId, scope.hubId);
  if (!transfer || transfer.toOrganizationId !== scope.organizationId || transfer.voidedAt) throw new Error("Transfer not found");
  const organizationType: OrganizationType = transfer.kind === "RAW_MATERIAL" ? "MANUFACTURER" : "DISTRIBUTOR";
  requireOrganizationScope(account, [scope.role], organizationType);
  if (transfer.status === "RECEIVED") throw new Error("This transfer was already confirmed");
  const received: Transfer = { ...transfer, quantityReceived: details.quantityReceived, status: "RECEIVED", hasDiscrepancy: toThousandths(details.quantityReceived) !== toThousandths(transfer.quantitySent), note: details.note ?? transfer.note, receivedAt: now.toISOString(), receivedById: scope.userId, updatedAt: now.toISOString() };
  await getRepository().put("Transfer", received);
  return received;
}

// ---- Products and batches -------------------------------------------------

export const batchLabel = (batch: Pick<Batch, "number">) => `B-${String(batch.number).padStart(4, "0")}`;

export type BatchRow = Batch & { label: string; productName: string; unit: ProductUnit; yieldLabel: string; sentThousandths: number; remainingThousandths: number; organizationName: string };

function yieldLabel(batch: Batch, unit: ProductUnit): string {
  const input = toThousandths(batch.inputKg);
  if (input === 0) return "—";
  const produced = toThousandths(batch.quantityProduced);
  return unit === "KG" ? `${((produced / input) * 100).toFixed(1)}%` : `${(produced / input).toFixed(2)} units/kg`;
}

export function yieldPercent(batch: Pick<Batch, "inputKg" | "quantityProduced">): number | null {
  const input = toThousandths(batch.inputKg);
  return input ? (toThousandths(batch.quantityProduced) / input) * 100 : null;
}

export async function listBatches(account: Account): Promise<BatchRow[]> {
  const scope = requireRole(account, ["HUB_ADMIN", "MANUFACTURER"]);
  const repository = getRepository();
  const [batches, products, transfers, organizations] = await Promise.all([repository.list("Batch", scope.hubId), repository.list("Product", scope.hubId), repository.list("Transfer", scope.hubId), repository.list("Organization", scope.hubId)]);
  return batches
    .filter((batch) => scope.role === "HUB_ADMIN" || batch.organizationId === scope.organizationId)
    .map((batch): BatchRow => {
      const product = products.find((item) => item.id === batch.productId);
      const unit = product?.unit ?? "KG";
      const sentThousandths = transfers.filter((transfer) => live(transfer) && transfer.batchId === batch.id).reduce((sum, transfer) => sum + toThousandths(transfer.quantitySent), 0);
      return { ...batch, label: batchLabel(batch), productName: product?.name ?? "Product", unit, yieldLabel: yieldLabel(batch, unit), sentThousandths, remainingThousandths: batch.voidedAt ? 0 : toThousandths(batch.quantityProduced) - sentThousandths, organizationName: organizations.find((organization) => organization.id === batch.organizationId)?.name ?? "" };
    })
    .sort((a, b) => b.number - a.number);
}

export async function listProducts(hubId: string, organizationId: string): Promise<Product[]> {
  return (await getRepository().list("Product", hubId)).filter((product) => product.organizationId === organizationId).sort((a, b) => a.name.localeCompare(b.name));
}

// Raw-material transfers a manufacturer received and has not used in a batch yet.
export async function listUnusedReceivedTransfers(hubId: string, organizationId: string): Promise<Transfer[]> {
  const repository = getRepository();
  const [transfers, batches] = await Promise.all([repository.list("Transfer", hubId), repository.list("Batch", hubId)]);
  const used = new Set(batches.filter(live).flatMap((batch) => batch.transferIds));
  return transfers.filter((transfer) => transfer.kind === "RAW_MATERIAL" && transfer.toOrganizationId === organizationId && transfer.status === "RECEIVED" && live(transfer) && !used.has(transfer.id));
}

export const BatchInput = z.object({
  productId: z.string().min(1).optional(),
  newProductName: z.string().trim().min(2).max(80).optional(),
  newProductUnit: z.enum(["KG", "UNIT"]).optional(),
  transferIds: z.array(z.string().min(1)).min(1, "Select the raw material used"),
  quantityProduced: positive,
  wastageKg: Quantity,
});

// A production run: which received raw material went in, what came out, and what was wasted.
export async function createBatch(account: Account, input: unknown, now = new Date()): Promise<Batch> {
  const scope = requireOrganizationScope(account, ["MANUFACTURER"], "MANUFACTURER");
  const details = BatchInput.parse(input);
  const repository = getRepository();
  const timestamp = now.toISOString();

  let productId = details.productId;
  if (productId) {
    const product = await repository.get("Product", productId, scope.hubId);
    if (!product || product.organizationId !== scope.organizationId) throw new Error("Choose one of your products");
  } else if (details.newProductName && details.newProductUnit) {
    productId = createUuidV7();
    await repository.put("Product", { id: productId, hubId: scope.hubId, organizationId: scope.organizationId, name: details.newProductName, unit: details.newProductUnit, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp });
  } else {
    throw new Error("Choose a product or name a new one");
  }

  const unused = new Map((await listUnusedReceivedTransfers(scope.hubId, scope.organizationId)).map((transfer) => [transfer.id, transfer]));
  const transferIds = [...new Set(details.transferIds)];
  if (transferIds.some((id) => !unused.has(id))) throw new Error("Only received raw material that has not been used can go into a batch");
  const inputThousandths = transferIds.reduce((sum, id) => sum + toThousandths(unused.get(id)!.quantityReceived!), 0);
  if (toThousandths(details.wastageKg) > inputThousandths) throw new Error("Wastage cannot be more than the raw material used");

  const number = (await repository.list("Batch", scope.hubId)).reduce((max, batch) => Math.max(max, batch.number), 0) + 1;
  const batch: Batch = { id: createUuidV7(), hubId: scope.hubId, organizationId: scope.organizationId, number, productId, transferIds, inputKg: fromThousandths(inputThousandths), quantityProduced: details.quantityProduced, wastageKg: details.wastageKg, producedAt: timestamp, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await repository.put("Batch", batch);
  return batch;
}

export const FinishedTransferInput = z.object({
  toOrganizationId: z.string().min(1),
  batchId: z.string().min(1),
  quantitySent: positive,
  note: z.string().trim().max(500).optional().transform((note) => note || undefined),
});

// Manufacturers send finished goods from a batch to a distributor, never more than the batch has left.
export async function createFinishedGoodsTransfer(account: Account, input: unknown, now = new Date()): Promise<Transfer> {
  const scope = requireOrganizationScope(account, ["MANUFACTURER"], "MANUFACTURER");
  const details = FinishedTransferInput.parse(input);
  await requireRecipient(scope.hubId, details.toOrganizationId, "DISTRIBUTOR");
  const batch = (await listBatches(account)).find((item) => item.id === details.batchId);
  if (!batch || batch.voidedAt) throw new Error("Choose one of your batches");
  if (toThousandths(details.quantitySent) > batch.remainingThousandths) throw new Error(`Only ${fromThousandths(batch.remainingThousandths)} left in ${batch.label}`);
  const timestamp = now.toISOString();
  const transfer: Transfer = { id: createUuidV7(), hubId: scope.hubId, kind: "FINISHED_GOODS", fromOrganizationId: scope.organizationId, toOrganizationId: details.toOrganizationId, deliveryIds: [], productId: batch.productId, batchId: batch.id, unit: batch.unit, quantitySent: details.quantitySent, status: "SENT", hasDiscrepancy: false, note: details.note, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("Transfer", transfer);
  return transfer;
}
