import { redirect } from "next/navigation";
import { requireDashboardRole } from "@/auth/route-authorization";
import { HubTeamShell } from "@/components/team/hub-team-shell";
import { InviteForm } from "@/components/team/invite-form";
import { getTeam, invitableRoles } from "@/team/team-service";

export default async function NewHubInvitePage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const team = await getTeam(account);
  if (!team.hubVerified) redirect("/admin/team");
  return <HubTeamShell back={{ href: "/admin/team", label: "Team" }} title="Invite people" description="Choose the role and the organization they will belong to. Send it by email, or share the code or link anywhere.">
    <InviteForm backHref="/admin/team" organizations={team.organizations} roles={invitableRoles("HUB_ADMIN")} />
  </HubTeamShell>;
}
