"use client";

import { FileCheck2, LoaderCircle, LocateFixed, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { PhotoField } from "@/components/photo-field";
import { readDocument } from "@/lib/image";

type CountryOption = { id: string; name: string; dialCode: string; regions: readonly string[] };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <fieldset className="space-y-4 rounded-2xl border border-[#dce2d9] bg-white p-5"><legend className="px-1 font-semibold text-[var(--kinja-green)]">{title}</legend>{description && <p className="-mt-2 text-sm text-[#718074]">{description}</p>}{children}</fieldset>;
}

export function OnboardingForm({ countries, categories }: { countries: CountryOption[]; categories: readonly string[] }) {
  const router = useRouter();
  const { run, pending, error, setError } = useJsonAction();
  const [countryId, setCountryId] = useState(countries.length === 1 ? countries[0].id : "");
  const [gps, setGps] = useState("");
  const [locating, setLocating] = useState(false);
  const [certificate, setCertificate] = useState<{ url: string; name: string } | null>(null);
  const [certificateError, setCertificateError] = useState("");
  const [reading, setReading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const country = countries.find((item) => item.id === countryId);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => { setGps(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`); setLocating(false); }, () => setLocating(false), { enableHighAccuracy: true, timeout: 15000 });
  }

  async function selectCertificate(input: HTMLInputElement) {
    const file = input.files?.[0];
    setCertificateError("");
    if (!file) return;
    setReading(true);
    try {
      setCertificate({ url: await readDocument(file), name: file.name });
    } catch (readError) {
      input.value = "";
      setCertificate(null);
      setCertificateError(readError instanceof Error ? readError.message : "Could not read this file.");
    } finally {
      setReading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (!certificate) return setError("Upload your business registration certificate.");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await run<{ redirect?: string }>("/auth/onboarding/submit", { ...data, countryId, gps, registrationCertificateUrl: certificate.url, logoUrl });
    if (result?.redirect) router.push(result.redirect);
  }

  return <form className="space-y-5" onSubmit={submit}>
    <Section title="Business">
      <Label required text="Business name"><input className={inputClass} maxLength={120} minLength={2} name="businessName" placeholder="e.g. Jimmy's Group" required /></Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label required text="Business category"><select className={inputClass} defaultValue="" name="businessCategory" required><option disabled value="">Select a category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></Label>
        <Label required text="Year established"><input className={inputClass} max={new Date().getFullYear()} min={1900} name="yearEstablished" placeholder="e.g. 2019" required type="number" /></Label>
      </div>
    </Section>

    <Section title="Location">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label required text="Country"><select className={inputClass} onChange={(event) => setCountryId(event.target.value)} required value={countryId}><option disabled value="">Select a country</option>{countries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Label>
        <Label required text="Region or county">{country?.regions.length ? <select className={inputClass} defaultValue="" name="regionOrCounty" required><option disabled value="">Select</option>{country.regions.map((region) => <option key={region} value={region}>{region}</option>)}</select> : <input className={inputClass} disabled={!country} name="regionOrCounty" required />}</Label>
      </div>
      <Label required text="Physical address"><input className={inputClass} maxLength={200} minLength={3} name="physicalAddress" placeholder="Street, community, city" required /></Label>
      <div className="text-sm font-medium text-[#344e41]">GPS location <span className="font-normal text-[#718074]">(optional)</span><button className="mt-2 flex h-12 w-full items-center gap-3 rounded-xl border border-[#cbd2c9] bg-white px-4 text-left disabled:opacity-60" disabled={locating} onClick={locate} type="button">{locating ? <LoaderCircle className="animate-spin text-[var(--kinja-green)]" size={18} aria-hidden="true" /> : <LocateFixed className="text-[var(--kinja-green)]" size={18} aria-hidden="true" />}<span className={gps ? "text-[#344e41]" : "text-[#718074]"}>{locating ? "Getting location…" : gps || "Use current location"}</span></button></div>
    </Section>

    <Section title="Registration">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label required text="Registration number"><input className={inputClass} maxLength={60} minLength={2} name="registrationNumber" placeholder="e.g. REG-2026-001" required /></Label>
        <Label hint="(optional)" text="Tax ID"><input className={inputClass} maxLength={60} name="taxId" /></Label>
      </div>
      <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-[#cbd2c9] p-4 text-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e7eee4] text-[var(--kinja-green)]">{reading ? <LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> : certificate ? <FileCheck2 size={20} aria-hidden="true" /> : <Upload size={20} aria-hidden="true" />}</span>
        <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--kinja-green)]">Registration certificate <span className="text-[#b42318]">*</span></span><span className="block truncate text-[#718074]">{certificate ? certificate.name : "PDF (max 2MB) or a clear photo"}</span><input accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm" onChange={(event) => selectCertificate(event.currentTarget)} type="file" /></span>
      </label>
      {certificateError && <p className="text-sm text-[#b42318]" role="alert">{certificateError}</p>}
    </Section>

    <Section title="Contact person" description="Who Kinja should contact about this hub.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label required text="Full name"><input className={inputClass} maxLength={100} minLength={2} name="contactName" required /></Label>
        <Label required text="Title"><input className={inputClass} maxLength={80} minLength={2} name="contactTitle" placeholder="e.g. Director" required /></Label>
        <Label required text="Phone"><input className={inputClass} name="contactPhone" placeholder={country ? `${country.dialCode} …` : "+231 77 000 0000"} required type="tel" /></Label>
        <Label required text="Email"><input className={inputClass} name="contactEmail" required type="email" /></Label>
      </div>
    </Section>

    <Section title="Operations">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label required text="Approximate number of farmers"><input className={inputClass} min={0} name="approximateFarmerCount" required type="number" /></Label>
        <Label required text="Approximate number of cooperatives"><input className={inputClass} min={0} name="approximateCooperativeCount" required type="number" /></Label>
      </div>
    </Section>

    <Section title="Brand" description="Optional.">
      <PhotoField hint="(optional)" label="Logo" name="logo" onChange={setLogoUrl} value={logoUrl} />
      <Label hint="(optional)" text="Website or social page"><input className={inputClass} name="websiteOrSocialPage" placeholder="https://" type="url" /></Label>
    </Section>

    {error && <p className="rounded-xl border border-[#f3c7c2] bg-[#fdf1ef] px-4 py-3 text-sm text-[#9b2c1f]" role="alert">{error}{error.includes("expired") && <> <a className="font-semibold underline" href="/auth/signup">Create your account again</a></>}</p>}
    <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--kinja-green)] font-semibold text-white disabled:opacity-70" aria-busy={pending} disabled={pending || reading} type="submit">{pending ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" />Submitting…</> : "Submit for verification"}</button>
  </form>;
}
