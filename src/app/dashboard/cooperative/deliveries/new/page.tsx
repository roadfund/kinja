import { getMoneyContext } from "@/admin/exchange-rates";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { listHubCropOptions } from "@/field/deliveries";
import { listFarmers } from "@/field/farmers";
import { CooperativeShell } from "../../cooperative-shell";
import { DeliveryForm } from "../delivery-form";

export default async function NewDeliveryPage() {
  const { scope, user, hub } = await requireCooperativeMember();
  const { hubId, organizationId } = scope;
  const [farmers, crops, money] = await Promise.all([listFarmers(hubId, organizationId), listHubCropOptions(hubId), getMoneyContext(hub!)]);
  const farmerOptions = farmers.sort((a, b) => a.fullName.localeCompare(b.fullName)).map((farmer) => ({ id: farmer.id, name: farmer.fullName, plots: farmer.plots.flatMap((plot) => (plot.id ? [{ id: plot.id, description: plot.description }] : [])) }));
  const missing = crops.length === 0 ? "Your hub has not enabled any crops yet. Ask your hub admin to set up crops and prices." : null;

  return <CooperativeShell back={{ href: "/dashboard/cooperative/deliveries", label: "Deliveries" }} eyebrow="Kinja Field" title="Record a delivery" description="Capture the crop, weight and grade when a farmer delivers produce. The price is locked in when you save.">
    {missing ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">{missing}</p> : <DeliveryForm crops={crops} farmers={farmerOptions} money={money} userId={user.id} />}
  </CooperativeShell>;
}
