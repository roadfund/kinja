import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, formatDate } from "@/components/kinja/ui";
import { listProducts, listTransfers, listUnusedReceivedTransfers } from "@/manufacture/manufacture-service";
import { BatchForm } from "../../batch-form";

export default async function NewBatchPage() {
  const account = await requireOrganizationMember(["MANUFACTURER"], "MANUFACTURER");
  const { hubId, organizationId } = account.scope;
  const [products, unused, { transfers }] = await Promise.all([listProducts(hubId, organizationId), listUnusedReceivedTransfers(hubId, organizationId), listTransfers(account)]);
  const rows = new Map(transfers.map((transfer) => [transfer.id, transfer]));
  return <DashboardShell back={{ href: "/dashboard/manufacturer/batches", label: "Batches" }} eyebrow="Kinja Manufacture" title="New batch">
    <BatchForm products={products.map(({ id, name, unit }) => ({ id, name, unit }))} rawMaterial={unused.map((transfer) => ({ id: transfer.id, label: `${rows.get(transfer.id)?.itemName ?? "Raw material"} from ${rows.get(transfer.id)?.fromName ?? "cooperative"} · received ${formatDate(transfer.receivedAt!)}`, receivedKg: transfer.quantityReceived! }))} />
  </DashboardShell>;
}
