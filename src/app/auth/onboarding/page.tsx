import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { businessCategories, onboardingCountries } from "@/auth/hub-onboarding";
import { getRepository } from "@/repositories/server";
import { AuthFrame } from "../auth-frame";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  if (!(await cookies()).get("kinja_pending_signup")) redirect("/auth/signup");
  const crops = (await getRepository().list("Crop")).filter((crop) => crop.status === "ACTIVE").sort((a, b) => a.name.localeCompare(b.name));
  return <AuthFrame eyebrow="Start a hub" title="Tell us about your business" description="A Kinja admin reviews these details before your hub can invite people or run payouts. You can set up crops and prices while you wait.">
    <OnboardingForm categories={businessCategories} countries={onboardingCountries()} crops={crops.map(({ id, name }) => ({ id, name }))} />
  </AuthFrame>;
}
