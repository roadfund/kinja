import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { fromThousandths } from "@/domain/money";
import { listBatches, listOrganizations } from "@/manufacture/manufacture-service";
import { FinishedTransferForm } from "../../finished-transfer-form";

export default async function NewFinishedTransferPage() {
  const account = await requireOrganizationMember(["MANUFACTURER"], "MANUFACTURER");
  const [distributors, batches] = await Promise.all([listOrganizations(account.scope.hubId, "DISTRIBUTOR"), listBatches(account)]);
  const available = batches.filter((batch) => batch.remainingThousandths > 0);
  return <DashboardShell back={{ href: "/dashboard/manufacturer/transfers", label: "Transfers" }} eyebrow="Kinja Manufacture" title="Send finished goods">
    {distributors.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">There are no distributors in your hub yet. Ask your hub admin to invite one.</p>
      : available.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">No batch has stock left to send. Record a production batch first.</p>
      : <FinishedTransferForm batches={available.map((batch) => ({ id: batch.id, label: `${batch.label} · ${batch.productName}`, remaining: fromThousandths(batch.remainingThousandths), unitLabel: batch.unit === "KG" ? "kg" : "units" }))} distributors={distributors.map(({ id, name }) => ({ id, name }))} />}
  </DashboardShell>;
}
