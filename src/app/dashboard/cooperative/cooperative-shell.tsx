import { DashboardShell } from "@/components/kinja/ui";

export function CooperativeShell({ eyebrow, title, description, back = { href: "/dashboard/cooperative", label: "Cooperative overview" }, actions, children }: { eyebrow: string; title: string; description: string; back?: { href: string; label: string }; actions?: React.ReactNode; children: React.ReactNode }) {
  return <DashboardShell actions={actions} back={back} description={description} eyebrow={eyebrow} title={title}>{children}</DashboardShell>;
}
