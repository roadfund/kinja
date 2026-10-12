import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { businessCategories, onboardingCountries } from "@/auth/hub-onboarding";
import { peekPendingSignup } from "@/auth/server-store";
import { AuthFrame } from "../auth-frame";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const token = (await cookies()).get("kinja_pending_signup")?.value;
  const signup = token ? await peekPendingSignup(token) : null;
  // The signup expired or was already used: start again.
  if (!signup) redirect("/auth/signup");
  return <AuthFrame eyebrow="Start a hub" title="Tell us about your business" description="We need a few details about your business to get you started.">
    {/* The person setting up the hub is its contact person unless they change it. */}
    <OnboardingForm categories={businessCategories} contact={{ name: signup.fullName, phone: signup.phone, email: signup.email }} countries={onboardingCountries()} />
  </AuthFrame>;
}
