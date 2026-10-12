import Link from "next/link";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { PhotoField } from "@/components/photo-field";
import { signupErrors, type SignupError } from "@/auth/signup";
import { AuthFrame, Field, Notice } from "../auth-frame";
import { PasswordField } from "../password-field";
import { SubmitButton } from "../submit-button";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string; error?: string }> }) {
  const { invite, error } = await searchParams;
  const errorMessage = error && error in signupErrors ? signupErrors[error as SignupError] : null;
  const submitAction = invite ? `/auth/signup/submit?invite=${encodeURIComponent(invite)}` : "/auth/signup/submit";
  return <AuthFrame eyebrow="Create your account" title="Join Kinja" description={invite ? "Create your account to accept your invitation. You will join straight away." : "Create your account, then start a hub or accept an invitation."}>
    {errorMessage && <Notice>{errorMessage}</Notice>}<form action={submitAction} method="post" className="space-y-4"><PhotoField label="Profile photo" name="photoUrl" /><Field label="Full name" name="fullName" placeholder="e.g. Amina Doe" /><Field label="Username" name="username" placeholder="Choose a username" /><Field label="Phone" name="phone" type="tel" placeholder="+231 77 000 000" /><Field label="Email" name="email" type="email" placeholder="you@example.com" required={false} /><PasswordField label="Password" name="password" placeholder="At least 8 characters" minLength={8} /><SubmitButton className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--kinja-green)] font-semibold text-white"><UserPlus aria-hidden="true" size={18} />Continue<ArrowRight aria-hidden="true" size={17} /></SubmitButton></form>
    <p className="mt-6 flex items-center gap-1 text-sm text-[#5d685e]">Already have an account? <Link className="flex items-center gap-1 font-semibold text-[var(--kinja-green)]" href="/auth/login"><LogIn aria-hidden="true" size={15} />Sign in</Link></p>
  </AuthFrame>;
}