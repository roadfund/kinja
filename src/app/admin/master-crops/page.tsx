import { Sprout } from "lucide-react";
import { listMasterCrops } from "@/admin/master-crops";
import { requireDashboardRole } from "@/auth/route-authorization";
import { Badge, DashboardShell, EmptyState, formatDate, SectionHeader } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { AddCropForm, CropActions } from "./crop-list-actions";

export default async function MasterCropsPage() {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const crops = await listMasterCrops(account);
  return <DashboardShell eyebrow="Platform settings" title="Crop list" description="The master list of crops on Kinja. Hubs switch on the ones they work with and set their own grades and prices.">
    <AddCropForm />
    <SectionHeader description={`${crops.filter((crop) => crop.status === "ACTIVE").length} active`} title="All crops" />
    {crops.length === 0 ? <EmptyState description="Add the first crop above. Hubs cannot set up crops or record deliveries until the list has some." icon={<Sprout size={22} aria-hidden="true" />} title="No crops yet" /> :
      <DataTable muted={(crop) => crop.status === "ARCHIVED"} rowKey={(crop) => crop.id} rows={crops} columns={[
        { header: "Crop", cell: (crop) => <span className="font-medium text-[#344e41]">{crop.name}</span> },
        { header: "Status", cell: (crop) => crop.status === "ACTIVE" ? <Badge tone="green">Active</Badge> : <Badge tone="grey">Archived</Badge> },
        { header: "Hubs using it", align: "right", cell: (crop) => crop.hubsUsing },
        { header: "Added", cell: (crop) => formatDate(crop.createdAt) },
        { header: "", align: "right", cell: (crop) => <CropActions archived={crop.status === "ARCHIVED"} cropId={crop.id} name={crop.name} /> },
      ]} />}
  </DashboardShell>;
}
