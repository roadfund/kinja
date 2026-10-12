import { requireDashboardRole } from "@/auth/route-authorization";
import { HubTeamShell } from "@/components/team/hub-team-shell";
import { TeamOverview } from "@/components/team/team-overview";
import { getTeam } from "@/team/team-service";

export default async function TeamPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const team = await getTeam(account);
  return <HubTeamShell back={{ href: "/dashboard/hub", label: "Hub dashboard" }} title="Your team" description={`Everyone with access to ${team.hubName}, and the invites you have sent. Invite cooperative leads, manufacturers and distributors with a fixed role.`}>
    <TeamOverview inviteHref="/admin/team/new" team={team} />
  </HubTeamShell>;
}
