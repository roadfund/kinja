"use client";

import { Check, CheckCircle2, FileText, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import type { Hub } from "@/domain/model";

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs uppercase tracking-wide text-[#718074]">{label}</dt><dd className={`mt-1 text-sm font-medium ${value ? "text-[#344e41]" : "text-[#9aa69c]"}`}>{value ?? "Not provided"}</dd></div>;
}

export function HubReviewCard({ initialHub, countryName }: { initialHub: Hub; countryName?: string }) {
  const [hub, setHub] = useState(initialHub);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"VERIFIED" | "REJECTED" | null>(null);

  async function updateHub(decision: "VERIFIED" | "REJECTED") {
    if (pending) return;
    if (decision === "REJECTED" && !reason.trim()) return setError("A rejection reason is required");
    setPending(decision);
    setError("");
    try {
      const response = await fetch("/admin/hubs/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hubId: hub.id, decision, reason: reason.trim() || undefined }) });
      const body = (await response.json().catch(() => null)) as { status?: Hub["status"]; error?: string } | null;
      if (!response.ok || !body?.status) throw new Error(body?.error ?? "Unable to review this hub");
      setHub({ ...hub, status: body.status });
    } catch (reviewError) {
      setError(reviewError instanceof Error && reviewError.message !== "Failed to fetch" ? reviewError.message : "Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  if (hub.status !== "PENDING_VERIFICATION") return <div className="rounded-2xl border border-[#cce8d5] bg-[#f1fbf3] p-6"><CheckCircle2 className="text-[#08a875]" size={28} aria-hidden="true" /><p className="mt-4 font-semibold text-[var(--kinja-green)]">Hub {hub.status === "VERIFIED" ? "verified" : "rejected"}</p><p className="mt-1 text-sm text-[#5d685e]">This review is complete.</p></div>;

  return <div className="rounded-2xl border border-[#dce2d9] bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#718074]">Pending review</p><h2 className="mt-2 text-2xl font-semibold text-[var(--kinja-green)]">{hub.businessName}</h2></div><span className="rounded-full bg-[#fff5d9] px-3 py-1 text-sm font-semibold text-[#8b6818]">Needs review</span></div><dl className="mt-6 grid gap-x-6 gap-y-4 border-y border-[#e5e9e2] py-5 sm:grid-cols-2 xl:grid-cols-3">
      <Detail label="Category" value={`${hub.businessCategory} · since ${hub.yearEstablished}`} />
      <Detail label="Location" value={`${hub.physicalAddress}, ${hub.regionOrCounty}${countryName ? `, ${countryName}` : ""}`} />
      <Detail label="GPS" value={hub.gps ? <a className="underline" href={`https://www.openstreetmap.org/?mlat=${hub.gps.split(", ")[0]}&mlon=${hub.gps.split(", ")[1]}#map=15/${hub.gps.split(", ")[0]}/${hub.gps.split(", ")[1]}`} rel="noreferrer" target="_blank">{hub.gps}</a> : undefined} />
      <Detail label="Registration number" value={hub.businessRegistrationNumber} />
      <Detail label="Tax ID" value={hub.taxId} />
      <Detail label="Certificate" value={hub.registrationCertificateUrl.startsWith("data:") ? <a className="inline-flex items-center gap-1 font-semibold underline" download={`${hub.businessName} certificate.${hub.registrationCertificateUrl.startsWith("data:application/pdf") ? "pdf" : "jpg"}`} href={hub.registrationCertificateUrl}><FileText size={14} aria-hidden="true" />Download</a> : undefined} />
      <Detail label="Contact person" value={`${hub.contactPerson.fullName}, ${hub.contactPerson.title}`} />
      <Detail label="Contact phone and email" value={`${hub.contactPerson.phone} · ${hub.contactPerson.email}`} />
      <Detail label="Website" value={hub.websiteOrSocialPage ? <a className="break-all underline" href={hub.websiteOrSocialPage} rel="noreferrer" target="_blank">{hub.websiteOrSocialPage}</a> : undefined} />
      <Detail label="Works with" value={`About ${hub.approximateFarmerCount} farmers and ${hub.approximateCooperativeCount} cooperatives`} />
      <Detail label="Submitted" value={new Date(hub.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
    </dl><label className="mt-6 block text-sm font-medium text-[#344e41]">Rejection reason <span className="font-normal text-[#718074]">(only required when rejecting)</span><textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#cbd2c9] bg-white p-3 outline-none focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10" placeholder="Explain what needs to be corrected" value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error && <p className="mt-3 text-sm font-medium text-[#b42318]" role="alert">{error}</p>}<div className="mt-6 flex flex-wrap gap-3"><button className="inline-flex items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 py-3 font-semibold text-white" disabled={pending !== null} onClick={() => updateHub("VERIFIED")} type="button">{pending === "VERIFIED" ? <LoaderCircle className="animate-spin" aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={17} />}{pending === "VERIFIED" ? "Verifying…" : "Verify hub"}</button><button className="inline-flex items-center gap-2 rounded-xl border border-[#e0b4b0] px-5 py-3 font-semibold text-[#a33b32]" disabled={pending !== null} onClick={() => updateHub("REJECTED")} type="button">{pending === "REJECTED" ? <LoaderCircle className="animate-spin" aria-hidden="true" size={17} /> : <X aria-hidden="true" size={17} />}{pending === "REJECTED" ? "Rejecting…" : "Reject"}</button></div></div>;
}