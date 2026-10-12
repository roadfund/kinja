import { requireCooperativeMember } from "@/auth/route-authorization";
import { listHubCropOptions } from "@/field/deliveries";
import { CooperativeShell } from "../../cooperative-shell";
import { FarmerForm } from "../farmer-form";

export default async function NewFarmerPage() {
  const { scope, user } = await requireCooperativeMember();
  const crops = (await listHubCropOptions(scope.hubId)).map((crop) => crop.name);
  return <CooperativeShell back={{ href: "/dashboard/cooperative/farmers", label: "Farmers" }} eyebrow="Kinja Field" title="Register a farmer" description="Create a farmer record and capture the details your cooperative needs for field work.">
    {crops.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">Your hub has not enabled any crops yet. Ask your hub admin to set up crops and prices before registering farmers.</p> : <FarmerForm crops={crops} userId={user.id} />}
  </CooperativeShell>;
}
