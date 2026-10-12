import { notFound } from "next/navigation";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { listHubCropOptions } from "@/field/deliveries";
import { getFarmer } from "@/field/farmers";
import { CooperativeShell } from "../../../cooperative-shell";
import { FarmerForm } from "../../farmer-form";

export default async function EditFarmerPage({ params }: { params: Promise<{ farmerId: string }> }) {
  const { scope, user } = await requireCooperativeMember();
  const farmer = await getFarmer((await params).farmerId, { hubId: scope.hubId, cooperativeId: scope.organizationId });
  if (!farmer) notFound();
  // Keep crops the farmer already has, even if the hub has since disabled them.
  const hubCrops = (await listHubCropOptions(scope.hubId)).map((crop) => crop.name);
  const recorded = [...farmer.topCrops.map((crop) => crop.crop), ...farmer.plots.flatMap((plot) => plot.crops.filter((crop) => crop !== "Other"))];
  const crops = [...new Set([...hubCrops, ...recorded])];

  return <CooperativeShell back={{ href: `/dashboard/cooperative/farmers/${farmer.id}`, label: farmer.fullName }} eyebrow="Kinja Field" title="Edit farmer" description="Update this farmer's details, crops and plots. Plots with recorded deliveries cannot be removed.">
    <FarmerForm crops={crops} farmer={farmer} userId={user.id} />
  </CooperativeShell>;
}
