import { ScrollText } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { Badge, DashboardShell, DataTable, EmptyState } from "@/components/kinja/ui";
import { listAuditLog } from "@/ops/moderation";

export default async function AuditLogPage() {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const entries = await listAuditLog(account);
  return <DashboardShell eyebrow="Kinja Ops" title="Audit log" description="Every suspension, reinstatement, void, cancelled order and exchange rate change, with who did it, when and why.">
    {entries.length === 0 ? <EmptyState description="Moderation actions and voids will be listed here." icon={<ScrollText size={22} aria-hidden="true" />} title="Nothing logged yet" /> :
      <DataTable rowKey={(entry) => entry.id} rows={entries} columns={[
        { header: "When", cell: (entry) => new Date(entry.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) },
        { header: "Action", cell: (entry) => <Badge tone={entry.action === "REINSTATE" ? "green" : entry.action === "VOID" || entry.action === "CANCEL" ? "grey" : entry.action === "SET_RATE" || entry.action === "SET_CURRENCIES" ? "neutral" : "red"}>{entry.action.charAt(0) + entry.action.slice(1).toLowerCase().replace(/_/g, " ")}</Badge> },
        { header: "Record", cell: (entry) => entry.entity },
        { header: "Hub", cell: (entry) => entry.hubName ?? "—" },
        { header: "By", cell: (entry) => entry.actorName },
        { header: "Reason", cell: (entry) => entry.reason ?? "—" },
      ]} />}
  </DashboardShell>;
}
