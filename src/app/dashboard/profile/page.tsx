import { Building2, Globe2, Mail, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { countries } from "@/config/countries";
import { Avatar } from "@/components/avatar";
import { roleLabels } from "@/domain/person";
import { workspaceName } from "../sidebar-user-card";
import { PasswordForm, ProfileForm } from "./profile-forms";

function Detail({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 shrink-0 text-[#718074]" size={18} aria-hidden="true" /><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.14em] text-[#718074]">{label}</p><p className={`mt-1 break-words ${value ? "text-[var(--kinja-green)]" : "text-[#9aa69c]"}`}>{value || "Not added"}</p></div></div>;
}

export default async function ProfilePage() {
  const account = await requireDashboardRole(["TECH_ADMIN", "HUB_ADMIN", "COOP_LEAD", "FIELD_STAFF", "MANUFACTURER", "DISTRIBUTOR"]);
  const { user, hub, membership } = account;
  const country = countries.find((item) => item.id === hub?.countryId);

  return <section className="px-6 py-8 sm:px-10">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--kinja-green)]">Profile</p>
    <div className="mt-6 flex items-center gap-5"><Avatar className="h-20 w-20" name={user.fullName} photoUrl={user.photoUrl} seed={user.id} /><div className="min-w-0"><h1 className="truncate text-3xl font-semibold tracking-tight text-[var(--kinja-green)] sm:text-4xl">{user.fullName}</h1><p className="mt-1 text-[#5d685e]">@{user.username}</p></div></div>
    <div className="mt-10 grid gap-4">
      <ProfileForm profile={{ fullName: user.fullName, username: user.username, phone: user.phone, email: user.email, photoUrl: user.photoUrl }} />
      <section className="rounded-2xl bg-white p-6 sm:p-8"><h2 className="font-semibold text-[var(--kinja-green)]">Workspace</h2><div className="mt-6 grid gap-6 sm:grid-cols-2"><Detail icon={ShieldCheck} label="Role" value={membership ? roleLabels[membership.role] : undefined} /><Detail icon={Building2} label="Hub" value={hub?.businessName ?? workspaceName(account)} />{account.organization && <Detail icon={UsersRound} label="Organization" value={account.organization.name} />}{hub && <Detail icon={MapPin} label="Region" value={hub.regionOrCounty} />}{hub && <Detail icon={Globe2} label="Country" value={country?.name ?? hub.countryId.toUpperCase()} />}</div></section>
      <PasswordForm />
    </div>
  </section>;
}
