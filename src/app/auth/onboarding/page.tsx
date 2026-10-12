import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { businessCategories, onboardingCountries } from "@/auth/hub-onboarding";
import { AuthFrame } from "../auth-frame";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  if (!(await cookies()).get("kinja_pending_signup")) redirect("/auth/signup");
  return <AuthFrame eyebrow="Start a hub" title="Tell us about your business" description="We need a few details about your business to get you started.">
    <OnboardingForm categories={businessCategories} countries={onboardingCountries()} />
  </AuthFrame>;
}
