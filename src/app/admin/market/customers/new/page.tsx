import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { CustomerForm } from "@/components/market/customer-form";

export default async function HubNewCustomerPage() {
  await requireDashboardRole(["HUB_ADMIN"]);
  return <DashboardShell back={{ href: "/admin/market", label: "Customers" }} eyebrow="Kinja Market" title="Add customer"><CustomerForm backHref="/admin/market" /></DashboardShell>;
}
