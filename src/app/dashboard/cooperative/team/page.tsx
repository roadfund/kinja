import { requireDashboardRole } from "@/auth/route-authorization";
import { TeamOverview } from "@/components/team/team-overview";
import { getTeam } from "@/team/team-service";
import { CooperativeShell } from "../cooperative-shell";

export default async function CooperativeTeamPage() {
  const account = await requireDashboardRole(["COOP_LEAD"]);
  const team = await getTeam(account);
  return <CooperativeShell eyebrow="Team" title="Your team" description={`Field staff in ${account.organization?.name ?? "your cooperative"}, and the invites you have sent.`}>
    <TeamOverview inviteHref="/dashboard/cooperative/team/new" team={team} />
  </CooperativeShell>;
}
