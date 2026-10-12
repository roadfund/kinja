import Link from "next/link";
import { Building2, Clock3, LogIn, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { roleLabels } from "@/domain/person";
import { getInvitePreview } from "@/team/team-service";
import { AuthFrame, Notice } from "../../auth-frame";

const unavailable: Record<string, string> = {
  REVOKED: "This invitation was cancelled.",
  EXPIRED: "This invitation has expired.",
  EXHAUSTED: "This invitation has already been used.",
};
const errors: Record<string, string> = {
  member: "Your account already belongs to a hub. Each account can have one role, so use a different account to accept this invitation.",
  invalid: "This invitation could not be accepted. It may have just expired or been used.",
  limited: "Too many attempts. Please wait a while and try again.",
};

function daysLeft(expiresAt: string): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days <= 1 ? "This invitation expires within a day." : `This invitation expires in ${days} days.`;
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ code }, { error }] = await Promise.all([params, searchParams]);
  const invite = await getInvitePreview(decodeURIComponent(code));

  if (!invite || invite.status !== "ACTIVE") {
    return <AuthFrame eyebrow="Invitation" title="Invitation unavailable" description={invite ? unavailable[invite.status] : "We could not find this invitation. Check the link or code."}>
      <p className="text-sm leading-6 text-[#5d685e]">Ask the person who invited you to send a new invitation.</p>
      <Link className="mt-6 block text-sm font-semibold text-[var(--kinja-green)]" href="/auth/login">Go to sign in</Link>
    </AuthFrame>;
  }

  const query = `invite=${encodeURIComponent(invite.code)}`;
  return <AuthFrame eyebrow="You are invited" title={`Join ${invite.hubName}`} description={`${invite.invitedByName} invited you to join a Kinja team.`}>
    {error && errors[error] && <Notice>{errors[error]}</Notice>}
    <div className="rounded-2xl border border-[#dce2d9] bg-white p-5">
      <div className="flex items-start gap-3"><UserRound className="mt-0.5 text-[var(--kinja-green)]" size={20} aria-hidden="true" /><div><p className="text-sm text-[#718074]">Invited by</p><p className="mt-1 font-semibold text-[var(--kinja-green)]">{invite.invitedByName}</p></div></div>
      <div className="mt-5 grid gap-4 border-t border-[#e5e9e2] pt-5 sm:grid-cols-2">
        <div className="flex items-start gap-3"><Building2 className="mt-0.5 text-[var(--kinja-green)]" size={18} aria-hidden="true" /><div><p className="text-xs uppercase tracking-wide text-[#718074]">Organization</p><p className="mt-1 text-sm font-semibold text-[#344e41]">{invite.organizationName ?? invite.hubName}</p></div></div>
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-[var(--kinja-green)]" size={18} aria-hidden="true" /><div><p className="text-xs uppercase tracking-wide text-[#718074]">Your role</p><p className="mt-1 text-sm font-semibold text-[#344e41]">{roleLabels[invite.role]}</p></div></div>
      </div>
      <div className="mt-5 flex items-center gap-2 border-t border-[#e5e9e2] pt-4 text-sm text-[#718074]"><Clock3 size={16} aria-hidden="true" />{daysLeft(invite.expiresAt)}</div>
    </div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Link className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--kinja-green)] font-semibold text-white transition hover:bg-[#263d32]" href={`/auth/signup?${query}`}><UserPlus size={18} aria-hidden="true" />Create an account</Link>
      <Link className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cbd2c9] bg-white font-semibold text-[var(--kinja-green)]" href={`/auth/login?${query}`}><LogIn size={18} aria-hidden="true" />I have an account</Link>
    </div>
  </AuthFrame>;
}
