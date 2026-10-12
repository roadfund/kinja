import { LockKeyhole, MailPlus, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { CopyInviteLinkButton, RemoveMemberButton, RevokeInviteButton } from "@/components/team/team-actions";
import type { InviteStatus } from "@/domain/model";
import { roleLabels } from "@/domain/person";
import type { TeamView } from "@/team/team-service";

const statusStyles: Record<InviteStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-[#e7f6ef] text-[#1f6b45]" },
  EXHAUSTED: { label: "Used", className: "bg-[#e7eee4] text-[#344e41]" },
  EXPIRED: { label: "Expired", className: "bg-[#fff5d9] text-[#8b6818]" },
  REVOKED: { label: "Revoked", className: "bg-[#fdf1ef] text-[#9b2c1f]" },
};
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function SummaryCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">{label}</p><p className="mt-2 text-3xl font-semibold text-[var(--kinja-green)]">{value}</p><p className="mt-1 text-sm text-[#5d685e]">{detail}</p></div>;
}

export function TeamOverview({ team, inviteHref }: { team: TeamView; inviteHref: string }) {
  const { members, invites } = team;
  const active = invites.filter((invite) => invite.status === "ACTIVE").length;
  const accepted = invites.reduce((sum, invite) => sum + invite.uses, 0);
  const closed = invites.filter((invite) => invite.status === "EXPIRED" || invite.status === "REVOKED").length;

  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Members" value={members.length} detail={team.scope.role === "COOP_LEAD" ? "In your cooperative" : "Across your hub"} />
      <SummaryCard label="Active invites" value={active} detail="Waiting to be accepted" />
      <SummaryCard label="Invites accepted" value={accepted} detail="People who joined by invite" />
      <SummaryCard label="Expired or revoked" value={closed} detail="No longer usable" />
    </div>

    <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-xl font-semibold text-[var(--kinja-green)]">Members</h2><p className="mt-1 text-sm text-[#5d685e]">{members.length} {members.length === 1 ? "person" : "people"} with access</p></div>
      {team.hubVerified ? <Link className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white" href={inviteHref}><UserPlus size={17} aria-hidden="true" />Invite people</Link>
        : <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#eef1eb] px-5 text-sm font-semibold text-[#718074]" title="Available after hub verification"><LockKeyhole size={16} aria-hidden="true" />Invites unlock after verification</span>}
    </div>
    <DataTable rowKey={(member) => member.membershipId} rows={members} columns={[
      { header: "Name", cell: (member) => <span className="flex items-center gap-3"><Avatar className="h-8 w-8" name={member.fullName} photoUrl={member.photoUrl} seed={member.userId} /><span className="font-semibold text-[var(--kinja-green)]">{member.fullName}</span></span> },
      { header: "Role", cell: (member) => roleLabels[member.role] },
      { header: "Organization", cell: (member) => member.organizationName ?? team.hubName },
      { header: "Email", cell: (member) => member.email ?? "—" },
      { header: "Phone", cell: (member) => member.phone || "—" },
      { header: "Joined", cell: (member) => formatDate(member.joinedAt) },
      { header: "", align: "right", cell: (member) => member.canRemove ? <RemoveMemberButton membershipId={member.membershipId} name={member.fullName} /> : member.isSelf ? <Badge tone="neutral">You</Badge> : null },
    ]} />

    <div className="mt-10"><h2 className="text-xl font-semibold text-[var(--kinja-green)]">Invites</h2><p className="mt-1 text-sm text-[#5d685e]">Everyone you have invited, newest first</p></div>
    {invites.length === 0 ? <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 px-6 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7eee4] text-[var(--kinja-green)]"><MailPlus size={22} aria-hidden="true" /></span><p className="mt-4 font-semibold text-[var(--kinja-green)]">No invites yet</p><p className="mt-1 max-w-sm text-sm text-[#5d685e]">Invite people to give them access with a fixed role.</p></div> :
      <DataTable rowKey={(invite) => invite.id} rows={invites} columns={[
        { header: "Sent to", cell: (invite) => <span className="font-medium text-[#344e41]">{invite.email ?? "Shareable link"}</span> },
        { header: "Code", cell: (invite) => <span className="font-mono text-xs">{invite.code}</span> },
        { header: "Role", cell: (invite) => roleLabels[invite.role] },
        { header: "Organization", cell: (invite) => invite.organizationName ?? "—" },
        { header: "New organization", cell: (invite) => invite.isNewOrganization ? "Yes" : "No" },
        { header: "Invited by", cell: (invite) => invite.invitedByName },
        { header: "Sent", cell: (invite) => formatDate(invite.createdAt) },
        { header: "Expires", cell: (invite) => formatDate(invite.expiresAt) },
        { header: "Uses", align: "right", cell: (invite) => invite.uses },
        { header: "Max uses", align: "right", cell: (invite) => invite.maxUses },
        { header: "Status", cell: (invite) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[invite.status].className}`}>{statusStyles[invite.status].label}</span> },
        { header: "Link", cell: (invite) => invite.status === "ACTIVE" ? <CopyInviteLinkButton code={invite.code} /> : "—" },
        { header: "", align: "right", cell: (invite) => invite.status === "ACTIVE" ? <RevokeInviteButton inviteId={invite.id} label={invite.email ?? "Anyone with the link"} /> : null },
      ]} />}
    {members.length === 0 && <p className="mt-4 flex items-center gap-2 text-sm text-[#718074]"><UsersRound size={16} aria-hidden="true" />No members yet.</p>}
  </>;
}
