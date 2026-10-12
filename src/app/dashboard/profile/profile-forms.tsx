"use client";

import { KeyRound, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { PhotoField } from "@/components/photo-field";

export function ProfileForm({ profile }: { profile: { fullName: string; username: string; phone?: string; email?: string; photoUrl?: string } }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl ?? "");
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const data = new FormData(event.currentTarget);
    if (await run("/account/profile", { fullName: data.get("fullName"), phone: data.get("phone"), email: data.get("email"), photoUrl })) {
      setSaved(true);
      router.refresh();
    }
  }

  return <FormCard description="Your name and photo are shown to your team." icon={<UserRound size={20} aria-hidden="true" />} onSubmit={submit} title="Personal details">
    <PhotoField hint="(JPG, PNG or WebP, max 5MB)" label="Profile photo" name="photo" onChange={setPhotoUrl} value={photoUrl} />
    <div className="grid gap-5 sm:grid-cols-2">
      <Label required text="Full name"><input className={inputClass} defaultValue={profile.fullName} minLength={2} name="fullName" required /></Label>
      <Label hint="(cannot be changed)" text="Username"><input className={inputClass} disabled value={profile.username} /></Label>
      <Label required text="Phone"><input className={inputClass} defaultValue={profile.phone} minLength={7} name="phone" required type="tel" /></Label>
      <Label hint="(optional, used for password resets)" text="Email"><input className={inputClass} defaultValue={profile.email} name="email" type="email" /></Label>
    </div>
    <FormFooter error={error} label="Save changes" pending={pending} pendingLabel="Saving…" success={saved ? "Profile updated." : undefined} />
  </FormCard>;
}

export function PasswordForm() {
  const { run, pending, error, setError } = useJsonAction();
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) return setError("The new passwords do not match.");
    if (await run("/account/password", Object.fromEntries(data))) {
      form.reset();
      setSaved(true);
    }
  }

  return <FormCard description="Changing your password signs you out on every other device." icon={<KeyRound size={20} aria-hidden="true" />} onSubmit={submit} title="Change password">
    <div className="grid gap-5 sm:grid-cols-3">
      <Label required text="Current password"><input autoComplete="current-password" className={inputClass} name="currentPassword" required type="password" /></Label>
      <Label required text="New password"><input autoComplete="new-password" className={inputClass} minLength={8} name="newPassword" placeholder="At least 8 characters" required type="password" /></Label>
      <Label required text="Confirm new password"><input autoComplete="new-password" className={inputClass} minLength={8} name="confirmPassword" required type="password" /></Label>
    </div>
    <FormFooter error={error} label="Update password" pending={pending} pendingLabel="Updating…" success={saved ? "Password updated. Other devices have been signed out." : undefined} />
  </FormCard>;
}
