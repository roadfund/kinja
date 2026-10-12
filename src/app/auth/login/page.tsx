import Link from "next/link";
import { ArrowRight, KeyRound, LogIn, UserPlus, UserRound } from "lucide-react";
import { seedIfFresh } from "@/dev/seed";
import { AuthFrame, Field, Notice } from "../auth-frame";
import { PasswordField } from "../password-field";
import { SubmitButton } from "../submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invite?: string; error?: string; minutes?: string; reset?: string }> }) {
  const { invite, error, minutes, reset } = await searchParams;
  await seedIfFresh();
  const signupHref = invite ? `/auth/signup?invite=${encodeURIComponent(invite)}` : "/auth/signup";
  return <AuthFrame eyebrow="Welcome back" title="Sign in to Kinja" description="Enter your credentials to continue.">
    {reset && <Notice tone="success">Your password has been updated. Sign in with your new password.</Notice>}
    {error === "invalid" && <Notice>That username and password do not match.</Notice>}
    {invite && !error && <Notice tone="success">Sign in to accept your invitation. You will join straight away.</Notice>}
    {error === "nomembership" && <Notice>Your account is not part of a hub yet. Open the invite link you were sent, or start a hub.</Notice>}
    {error === "unavailable" && <Notice>Your access to this workspace is not available right now. Contact your hub admin.</Notice>}
    {error === "locked" && <Notice>Too many sign-in attempts. Try again in {Number(minutes) || 15} minutes, or reset your password.</Notice>}
    <form action="/auth/login/submit" method="post" className="space-y-5">{invite && <input name="invite" type="hidden" value={invite} />}<Field label="Username" name="username" placeholder="e.g. amina.doe" icon={UserRound} /><PasswordField label="Password" name="password" placeholder="Enter your password" /><SubmitButton className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--kinja-green)] font-semibold text-white transition hover:bg-[#263d32]"><LogIn aria-hidden="true" size={18} />Sign in<ArrowRight aria-hidden="true" size={17} /></SubmitButton></form>
    <div className="mt-6 flex items-center justify-between text-sm"><Link className="flex items-center gap-2 font-semibold text-[var(--kinja-green)]" href="/auth/reset-password"><KeyRound aria-hidden="true" size={15} />Forgot password?</Link><Link className="flex items-center gap-2 text-[#5d685e]" href={signupHref}><UserPlus aria-hidden="true" size={15} />Create an account</Link></div>
  </AuthFrame>;
}