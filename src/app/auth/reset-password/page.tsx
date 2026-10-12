import Link from "next/link";
import { CheckCircle2, KeyRound, Send, UserRound } from "lucide-react";
import { PASSWORD_MIN_LENGTH } from "@/auth/password";
import { findValidReset } from "@/auth/password-reset";
import { AuthFrame, Field, Notice } from "../auth-frame";
import { PasswordField } from "../password-field";
import { SubmitButton } from "../submit-button";

const buttonClass = "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--kinja-green)] font-semibold text-white transition hover:bg-[#263d32]";
const errors: Record<string, string> = {
  mismatch: "The two passwords do not match.",
  short: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  limited: "Too many reset requests. Please wait a while and try again.",
};
const backToLogin = <Link className="mt-6 block text-sm font-semibold text-[var(--kinja-green)]" href="/auth/login">Back to sign in</Link>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string; error?: string }> }) {
  const { token, sent, error } = await searchParams;
  const errorMessage = error ? errors[error] : null;

  if (token) {
    if (!(await findValidReset(token))) return <AuthFrame eyebrow="Account recovery" title="Link expired" description="This reset link is invalid, has expired, or was already used."><Link className={buttonClass} href="/auth/reset-password"><Send aria-hidden="true" size={18} />Request a new link</Link>{backToLogin}</AuthFrame>;
    return <AuthFrame eyebrow="Account recovery" title="Choose a new password" description="Your new password will sign you out of every other device.">
      {errorMessage && <Notice>{errorMessage}</Notice>}
      <form action="/auth/reset-password/confirm" method="post" className="space-y-5"><input name="token" type="hidden" value={token} /><PasswordField label="New password" name="password" placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} minLength={PASSWORD_MIN_LENGTH} /><PasswordField label="Confirm new password" name="confirm" placeholder="Type it again" minLength={PASSWORD_MIN_LENGTH} /><SubmitButton className={buttonClass}><KeyRound aria-hidden="true" size={18} />Update password</SubmitButton></form>
      {backToLogin}
    </AuthFrame>;
  }

  if (sent) return <AuthFrame eyebrow="Account recovery" title="Check your email" description="If an account with an email address matches, we sent it a reset link."><div className="rounded-2xl border border-[#cce8d5] bg-[#f1fbf3] p-5"><CheckCircle2 className="text-[#08a875]" aria-hidden="true" size={28} /><p className="mt-3 text-sm leading-6 text-[#5d685e]">The link expires in 30 minutes and works once. Accounts without an email address cannot be reset this way yet; ask your hub admin for help.</p></div>{backToLogin}</AuthFrame>;

  return <AuthFrame eyebrow="Account recovery" title="Reset your password" description="Enter your username or email and we will email you a reset link.">
    {errorMessage && <Notice>{errorMessage}</Notice>}
    <form action="/auth/reset-password/request" method="post" className="space-y-5"><Field label="Username or email" name="identifier" placeholder="e.g. amina.doe" icon={UserRound} /><SubmitButton className={buttonClass}><Send aria-hidden="true" size={18} />Send reset link</SubmitButton></form>
    {backToLogin}
  </AuthFrame>;
}
