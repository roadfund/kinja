import { AuthorizationError, requireOrganizationScope, requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { getMoneyContext } from "@/admin/exchange-rates";
import { formatDual, moneyItem } from "@/domain/currency";
import { formatQuantity, fromThousandths, toThousandths } from "@/domain/money";
import { roleLabels } from "@/domain/person";
import { listHubCropOptions, listDeliveries } from "@/field/deliveries";
import { listFarmers } from "@/field/farmers";
import { listBatches, listTransfers } from "@/manufacture/manufacture-service";
import { distributorStock, listInvoices, listSales } from "@/market/market-service";
import { listOrders, orderCategoryLabels, orderChannelLabels, orderStatusLabels } from "@/market/orders";
import { viewAccountForHub } from "@/ops/reporting-scope";
import { getRepository } from "@/repositories/server";

export const exportDatasets = ["farmers", "deliveries", "payouts", "transfers", "stock", "orders", "sales", "invoices"] as const;
export type ExportDataset = (typeof exportDatasets)[number];
export const datasetLabels: Record<ExportDataset, string> = { farmers: "Farmers", deliveries: "Deliveries", payouts: "Payouts", transfers: "Transfers", stock: "Stock", orders: "Orders", sales: "Sales", invoices: "Invoices" };

export type ExportTable = { title: string; headers: string[]; rows: string[][] };
const day = (iso: string) => iso.slice(0, 10);

// Which datasets each role owns and can export.
export function datasetsFor(role: string): ExportDataset[] {
  switch (role) {
    case "TECH_ADMIN":
    case "HUB_ADMIN": return [...exportDatasets];
    case "COOP_LEAD": return ["farmers", "deliveries", "payouts", "transfers"];
    case "FIELD_STAFF": return ["farmers", "deliveries"];
    case "MANUFACTURER": return ["transfers", "stock"];
    case "DISTRIBUTOR": return ["transfers", "stock", "orders", "sales", "invoices"];
    default: return [];
  }
}

// Builds an export with exactly what the requesting role can see on screen.
export async function buildExport(account: Account, dataset: ExportDataset, hubId?: string | null): Promise<ExportTable> {
  const base = requireRole(account, ["TECH_ADMIN", "HUB_ADMIN", "COOP_LEAD", "FIELD_STAFF", "MANUFACTURER", "DISTRIBUTOR"]);
  if (!datasetsFor(base.role).includes(dataset)) throw new AuthorizationError("You cannot export this data");
  const viewer = base.role === "TECH_ADMIN" ? await viewAccountForHub(account, hubId) : account;
  const role = viewer.membership!.role;
  const hub = viewer.hub!;
  const title = `${datasetLabels[dataset]} - ${viewer.organization?.name ?? hub.businessName}`;
  // Amounts show the recorded currency, then the others at the rate in force on the record's date.
  const money = await getMoneyContext(hub);
  const dual = (minor: number, currency: string, at?: string) => formatDual(money, moneyItem(minor, currency, at));

  if (dataset === "farmers" || dataset === "deliveries" || dataset === "payouts") {
    const cooperativeIds = role === "HUB_ADMIN" ? (await getRepository().list("Organization", hub.id)).filter((org) => org.type === "COOPERATIVE").map((org) => org.id) : [requireOrganizationScope(viewer, ["COOP_LEAD", "FIELD_STAFF"], "COOPERATIVE").organizationId];
    const farmers = (await Promise.all(cooperativeIds.map((id) => listFarmers(hub.id, id)))).flat();
    if (dataset === "farmers") {
      return { title, headers: ["Name", "Gender", "Age", "Phone", "Mobile money", "Community", "Top crop", "Plots", "Farmland (ac)", "Registered"], rows: farmers.map((farmer) => [farmer.fullName, farmer.gender, String(farmer.age), farmer.phone ?? "", farmer.mobileMoneyNumber ?? "", farmer.community, farmer.topCrops[0]?.crop ?? "", String(farmer.plots.length), farmer.plots.reduce((sum, plot) => sum + (plot.unit === "HECTARES" ? plot.size * 2.471 : plot.size), 0).toFixed(1), day(farmer.createdAt)]) };
    }
    if (dataset === "payouts") {
      const payouts = (await getRepository().list("Payout", hub.id)).filter((payout) => farmers.some((farmer) => farmer.id === payout.farmerId));
      return { title, headers: ["Date", "Farmer", "Amount", "Method", "Status", "Reference"], rows: payouts.map((payout) => [day(payout.createdAt), farmers.find((farmer) => farmer.id === payout.farmerId)?.fullName ?? "", dual(payout.amountMinor, payout.currency, payout.createdAt), payout.method, payout.status, payout.providerReference ?? ""]) };
    }
    const crops = await listHubCropOptions(hub.id);
    const deliveries = (await Promise.all(cooperativeIds.map((id) => listDeliveries(hub.id, id)))).flat();
    const currency = crops[0]?.currency ?? "LRD";
    return { title, headers: ["Date", "Farmer", "Crop", "Grade", "Kg", "Price per kg", "Amount owed", "Status"], rows: deliveries.map((delivery) => { const crop = crops.find((item) => item.cropId === delivery.cropId); return [day(delivery.createdAt), farmers.find((farmer) => farmer.id === delivery.farmerId)?.fullName ?? "", crop?.name ?? delivery.cropId, crop?.grades.find((grade) => grade.gradeId === delivery.gradeId)?.name ?? delivery.gradeId, delivery.kilograms, dual(delivery.priceMinorPerKg, currency, delivery.createdAt), dual(delivery.amountOwedMinor, currency, delivery.createdAt), delivery.voidedAt ? "Voided" : "Recorded"]; }) };
  }

  if (dataset === "transfers") {
    const { transfers } = await listTransfers(viewer);
    return { title, headers: ["Sent", "From", "To", "Goods", "Sent qty", "Received qty", "Status", "Discrepancy", "Linked deliveries"], rows: transfers.map((transfer) => [day(transfer.createdAt), transfer.fromName, transfer.toName, transfer.itemName, formatQuantity(toThousandths(transfer.quantitySent), transfer.unit), transfer.quantityReceived ? formatQuantity(toThousandths(transfer.quantityReceived), transfer.unit) : "", transfer.voidedAt ? "Voided" : transfer.status, transfer.hasDiscrepancy ? "Yes" : "No", String(transfer.deliveryIds.length)]) };
  }

  if (dataset === "stock") {
    if (role === "DISTRIBUTOR") {
      const stock = await distributorStock(hub.id, viewer.membership!.organizationId!);
      return { title, headers: ["Product", "Batch", "Received", "Sold", "Available"], rows: stock.map((row) => [row.productName, row.batchLabel, formatQuantity(row.receivedThousandths, row.unit), formatQuantity(row.soldThousandths, row.unit), formatQuantity(row.availableThousandths, row.unit)]) };
    }
    const batches = await listBatches(viewer);
    return { title, headers: ["Batch", "Manufacturer", "Product", "Produced", "Input kg", "Output", "Wastage kg", "Yield", "Left"], rows: batches.map((batch) => [batch.label, batch.organizationName, batch.productName, day(batch.producedAt), batch.inputKg, formatQuantity(toThousandths(batch.quantityProduced), batch.unit), batch.wastageKg, batch.yieldLabel, fromThousandths(batch.remainingThousandths)]) };
  }

  if (dataset === "orders") {
    // One row per order, SKUs and quantities side by side, like the hub's order sheet.
    const orders = await listOrders(viewer);
    return { title, headers: ["Order", "Date", "Status", "Distributor", "Customer", "SKUs", "Quantities", "Order value", "Discount", "Payment value", "Category", "Channel", "Delivered by", "Delivery date", "Invoice"], rows: orders.map((order) => [order.label, order.orderedOn, orderStatusLabels[order.status], order.distributorName, order.customerName, order.lines.map((line) => line.productName).join(", "), order.lines.map((line) => line.quantity).join(", "), dual(order.valueMinor, order.currency, order.orderedOn), `${order.discountBasisPoints / 100}%`, dual(order.paymentMinor, order.currency, order.orderedOn), orderCategoryLabels[order.category], orderChannelLabels[order.channel], order.deliveredBy ?? "", order.deliveredOn ?? "", order.invoiceLabels.join(", ")]) };
  }

  if (dataset === "sales") {
    const sales = await listSales(viewer);
    return { title, headers: ["Date", "Distributor", "Customer", "Product", "Batch", "Quantity", "Unit price", "Amount", "Invoice"], rows: sales.map((sale) => [day(sale.soldAt), sale.distributorName, sale.customerName, sale.productName, sale.batchLabel, sale.quantity, dual(sale.unitPriceMinor, sale.currency, sale.soldAt), dual(sale.amountMinor - (sale.discountMinor ?? 0), sale.currency, sale.soldAt), sale.voidedAt ? "Voided" : sale.invoiceLabel ?? ""]) };
  }

  const invoices = await listInvoices(viewer);
  return { title, headers: ["Invoice", "Distributor", "Customer", "Issued", "Due", "Total", "Collected", "Outstanding", "Status"], rows: invoices.map((invoice) => [invoice.label, invoice.distributorName, invoice.customerName, day(invoice.issuedAt), invoice.dueDate, dual(invoice.totalMinor, invoice.currency, invoice.issuedAt), dual(invoice.collectedMinor, invoice.currency, invoice.issuedAt), dual(invoice.outstandingMinor, invoice.currency, invoice.issuedAt), invoice.status]) };
}

export function exportSubtitle(account: Account): string {
  return `Exported ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by ${account.user.fullName} (${account.membership ? roleLabels[account.membership.role] : ""})`;
}
