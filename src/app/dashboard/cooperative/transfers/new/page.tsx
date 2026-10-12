import { redirect } from "next/navigation";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { DashboardShell, formatDate } from "@/components/kinja/ui";
import { listHubCropOptions } from "@/field/deliveries";
import { listFarmers } from "@/field/farmers";
import { listOrganizations, listSendableDeliveries } from "@/manufacture/manufacture-service";
import { RawTransferForm } from "../raw-transfer-form";

export default async function NewRawTransferPage() {
  const account = await requireCooperativeMember();
  if (account.scope.role !== "COOP_LEAD") redirect("/dashboard/cooperative");
  const { hubId, organizationId } = account.scope;
  const [manufacturers, deliveries, farmers, crops] = await Promise.all([listOrganizations(hubId, "MANUFACTURER"), listSendableDeliveries(hubId, organizationId), listFarmers(hubId, organizationId), listHubCropOptions(hubId)]);
  const farmerName = new Map(farmers.map((farmer) => [farmer.id, farmer.fullName]));
  const cropOptions = crops.filter((crop) => deliveries.some((delivery) => delivery.cropId === crop.cropId)).map((crop) => ({ id: crop.cropId, name: crop.name }));
  const gradeName = (cropId: string, gradeId: string) => crops.find((crop) => crop.cropId === cropId)?.grades.find((grade) => grade.gradeId === gradeId)?.name ?? gradeId;

  return <DashboardShell back={{ href: "/dashboard/cooperative/transfers", label: "Transfers" }} eyebrow="Kinja Manufacture" title="Send raw material" description="The manufacturer confirms how much arrived. Any difference is flagged.">
    {manufacturers.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">There are no manufacturers in your hub yet. Ask your hub admin to invite one.</p>
      : cropOptions.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">All accepted deliveries have already been sent. Record new deliveries first.</p>
      : <RawTransferForm crops={cropOptions} deliveries={deliveries.map((delivery) => ({ id: delivery.id, cropId: delivery.cropId, farmerName: farmerName.get(delivery.farmerId) ?? "Farmer", date: formatDate(delivery.createdAt), kilograms: delivery.kilograms, gradeName: gradeName(delivery.cropId, delivery.gradeId) }))} manufacturers={manufacturers.map(({ id, name }) => ({ id, name }))} />}
  </DashboardShell>;
}
