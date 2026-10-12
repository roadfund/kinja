"use client";

import { Check, ChevronLeft, Copy, Link2, LoaderCircle, Mail, Plus, Send, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OrganizationType, Role } from "@/domain/model";
import { roleLabels } from "@/domain/person";

type OrganizationOption = { id: string; name: string; type: OrganizationType };
type CreatedInvite = { code: string; role: Role; email?: string; maxUses: number; expiresAt: string };

const NEW_ORGANIZATION = "__new__";
const organizationTypeForRole: Partial<Record<Role, OrganizationType>> = { COOP_LEAD: "COOPERATIVE", MANUFACTURER: "MANUFACTURER", DISTRIBUTOR: "DISTRIBUTOR" };
const typeLabels: Record<OrganizationType, string> = { COOPERATIVE: "cooperative", MANUFACTURER: "manufacturer", DISTRIBUTOR: "distributor" };
const inputClass = "mt-2 h-12 w-full rounded-xl border border-[#cbd2c9] bg-white px-4 outline-none focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10";
const labelClass = "block text-sm font-medium text-[#344e41]";

// Hub admins choose a role and an organization (existing or new); cooperative
// leads invite field staff into their own cooperative, so they skip both.
export function InviteForm({ roles, organizations, cooperativeName, backHref }: { roles: Role[]; organizations: OrganizationOption[]; cooperativeName?: string; backHref: string }) {
  const [role, setRole] = useState<Role>(roles[0]);
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [multiUse, setMultiUse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const orgType = organizationTypeForRole[role];
  const choosesOrganization = !cooperativeName && orgType !== undefined;
  const matchingOrganizations = organizations.filter((organization) => organization.type === orgType);
  const inviteUrl = invite ? `${window.location.origin}/auth/invite/${invite.code}` : "";

  function reset() {
    setInvite(null); setEmail(""); setMultiUse(false); setOrganizationId(""); setOrganizationName(""); setCopied(false); setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !event.currentTarget.reportValidity()) return;
    setSaving(true);
    setError("");
    const organization = !choosesOrganization ? {} : organizationId === NEW_ORGANIZATION ? { organizationName } : { organizationId };
    try {
      const response = await fetch("/team/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, email, multiUse, ...organization }) });
      const body = (await response.json().catch(() => null)) as (CreatedInvite & { error?: string }) | null;
      if (!response.ok || !body?.code) throw new Error(body?.error ?? "Could not create the invite.");
      setInvite(body);
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message !== "Failed to fetch" ? submitError.message : "Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    await navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
  }

  if (invite) {
    return <div className="rounded-2xl border border-[#cce8d5] bg-[#f1fbf3] p-6 sm:p-8">
      <Check className="text-[#08a875]" size={26} aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-[var(--kinja-green)]">Invite ready</h2>
      <p className="mt-1 text-sm leading-6 text-[#5d685e]">{invite.email ? <>We emailed the invitation to <strong className="font-semibold">{invite.email}</strong>. You can also share the code or link below.</> : "Share this code or link with the person you are inviting."} {invite.maxUses > 1 ? `It can be used ${invite.maxUses} times` : "It can be used once"} and expires on {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-4"><p className="text-xs uppercase tracking-wide text-[#718074]">Code</p><p className="mt-2 text-xl font-bold tracking-[0.12em] text-[var(--kinja-green)]">{invite.code}</p></div>
        <div className="rounded-xl bg-white p-4"><p className="text-xs uppercase tracking-wide text-[#718074]">Role</p><p className="mt-2 text-xl font-semibold text-[var(--kinja-green)]">{roleLabels[invite.role]}</p></div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-[#5d685e]"><Link2 className="shrink-0" size={16} aria-hidden="true" /><span className="min-w-0 flex-1 break-all">{inviteUrl}</span><button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#cbd2c9] px-3 py-1.5 font-semibold text-[var(--kinja-green)]" onClick={copy} type="button">{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button></div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white" onClick={reset} type="button"><Plus size={17} aria-hidden="true" />Invite another</button>
        <Link className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cbd2c9] bg-white px-5 font-semibold text-[var(--kinja-green)]" href={backHref}><ChevronLeft size={17} aria-hidden="true" />Back to team</Link>
      </div>
    </div>;
  }

  return <form className="space-y-5 rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8" onSubmit={submit}>
    <div className="flex items-start gap-3"><UsersRound className="mt-0.5 text-[var(--kinja-green)]" size={22} aria-hidden="true" /><div><h2 className="font-semibold text-[var(--kinja-green)]">Invite a team member</h2><p className="mt-1 text-sm leading-6 text-[#5d685e]">The role and organization are fixed by the invite. The person cannot change them.</p></div></div>
    <div className="grid gap-5 sm:grid-cols-2">
      {roles.length > 1 ? <label className={labelClass}>Role <span className="text-[#b42318]">*</span><select className={inputClass} value={role} onChange={(event) => { setRole(event.target.value as Role); setOrganizationId(""); }}>{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
        : <div className={labelClass}>Role<p className={`${inputClass} flex items-center bg-[#f7f9f5] text-[#5d685e]`}>{roleLabels[role]}</p></div>}
      {cooperativeName && <div className={labelClass}>Cooperative<p className={`${inputClass} flex items-center bg-[#f7f9f5] text-[#5d685e]`}>{cooperativeName}</p></div>}
      {choosesOrganization && <label className={labelClass}>{orgType && `${typeLabels[orgType][0].toUpperCase()}${typeLabels[orgType].slice(1)}`} <span className="text-[#b42318]">*</span><select className={inputClass} required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select a {orgType && typeLabels[orgType]}</option>{matchingOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}<option value={NEW_ORGANIZATION}>+ New {orgType && typeLabels[orgType]}</option></select></label>}
      {choosesOrganization && organizationId === NEW_ORGANIZATION && <label className={labelClass}>New {orgType && typeLabels[orgType]} name <span className="text-[#b42318]">*</span><input className={inputClass} maxLength={80} minLength={2} placeholder="e.g. Totota Growers" required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /><span className="mt-1 block text-xs font-normal text-[#718074]">Created when the invite is accepted.</span></label>}
      <label className={labelClass}>Email <span className="font-normal text-[#718074]">(optional, we send the invite)</span><span className="relative block"><Mail className="absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-[#718074]" size={18} aria-hidden="true" /><input className={`${inputClass} pl-11`} placeholder="teammate@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></span></label>
    </div>
    <label className="flex items-start gap-3 text-sm text-[#344e41]"><input className="mt-0.5 h-5 w-5 accent-[var(--kinja-green)]" type="checkbox" checked={multiUse} onChange={(event) => setMultiUse(event.target.checked)} /><span><span className="font-semibold">Create a multi-use code</span><span className="mt-1 block text-[#718074]">For onboarding a group: up to 25 people can use it within 7 days.</span></span></label>
    <div className="flex flex-wrap items-center justify-end gap-4">
      {error && <p className="text-sm font-medium text-[#b42318]" role="alert">{error}</p>}
      <Link className="inline-flex h-12 items-center rounded-xl px-4 font-semibold text-[#5d685e]" href={backHref}>Cancel</Link>
      <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white disabled:opacity-70" aria-busy={saving} disabled={saving} type="submit">{saving ? <LoaderCircle className="animate-spin" aria-hidden="true" size={17} /> : <Send aria-hidden="true" size={17} />}{saving ? "Creating invite…" : "Create invite"}</button>
    </div>
  </form>;
}
