import { redirect } from "next/navigation";
import { requireDashboardRole } from "@/auth/route-authorization";
import { InviteForm } from "@/components/team/invite-form";
import { getTeam, invitableRoles } from "@/team/team-service";
import { CooperativeShell } from "../../cooperative-shell";

export default async function NewCooperativeInvitePage() {
  const account = await requireDashboardRole(["COOP_LEAD"]);
  const team = await getTeam(account);
  if (!team.hubVerified) redirect("/dashboard/cooperative/team");
  return <CooperativeShell back={{ href: "/dashboard/cooperative/team", label: "Team" }} eyebrow="Team" title="Invite field staff" description="Field staff can register farmers and record deliveries for your cooperative.">
    <InviteForm backHref="/dashboard/cooperative/team" cooperativeName={account.organization?.name ?? "Your cooperative"} organizations={[]} roles={invitableRoles("COOP_LEAD")} />
  </CooperativeShell>;
}
