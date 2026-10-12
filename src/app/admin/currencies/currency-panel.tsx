"use client";

import { ArrowLeftRight, Check, Lock, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { formatRate, parseRate } from "@/domain/currency";
import { cn } from "@/lib/utils";

type RateNow = { currency: string; rateTenThousandths?: number; previousTenThousandths?: number; since?: string; setBy?: string };
type Props = { countryId: string; countryName: string; primary: string; currencies: string[]; supported: string[]; names: Record<string, string>; rates: RateNow[] };

const since = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const decimal = /^\d+(\.\d{1,2})?$/;

// Accepted currencies for one country, and the rate card for each one beside the main currency.
export function CurrencyPanel({ countryId, countryName, primary, currencies, supported, names, rates }: Props) {
  const router = useRouter();
  const toggle = useJsonAction();
  const extras = currencies.slice(1);

  async function setAccepted(currency: string, on: boolean) {
    const next = on ? [...extras, currency] : extras.filter((code) => code !== currency);
    if (await toggle.run("/ops/currencies", { countryId, extraCurrencies: next })) router.refresh();
  }

  return <section className="rounded-2xl border border-[#dce2d9] bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eef1eb] p-5 sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#718074]">Country</p><h2 className="mt-1 text-xl font-semibold text-[var(--kinja-green)]">{countryName}</h2><p className="mt-1 text-sm text-[#5d685e]">Every amount in {countryName} hubs shows in each accepted currency.</p></div>
      <div className="rounded-xl bg-[#f7f9f5] px-4 py-3"><p className="text-xs text-[#718074]">Main currency</p><p className="mt-0.5 flex items-center gap-1.5 font-semibold text-[#344e41]"><Lock size={13} aria-hidden="true" className="text-[#9aa69c]" />{primary} · {names[primary] ?? primary}</p></div>
    </div>

    <div className="border-b border-[#eef1eb] p-5 sm:p-6">
      <p className="text-sm font-medium text-[#344e41]">Accepted currencies</p>
      <p className="mt-1 text-sm text-[#718074]">Turning one off stops new orders in it. Records already made in it keep showing.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--kinja-green)] bg-[#e7eee4] px-4 text-sm font-semibold text-[var(--kinja-green)]"><Check size={15} aria-hidden="true" />{primary}<span className="font-normal text-[#5d685e]">main</span></span>
        {supported.filter((code) => code !== primary).map((code) => {
          const on = extras.includes(code);
          return <button aria-pressed={on} className={cn("inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-60", on ? "border-[var(--kinja-green)] bg-[#e7eee4] text-[var(--kinja-green)]" : "border-[#cbd2c9] bg-white text-[#5d685e] hover:border-[var(--kinja-green)]")} disabled={toggle.pending} key={code} onClick={() => setAccepted(code, !on)} type="button">
            <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-[var(--kinja-green)] bg-[var(--kinja-green)] text-white" : "border-[#9aa69c]")}>{on && <Check size={11} strokeWidth={3} aria-hidden="true" />}</span>{code}<span className="font-normal text-[#718074]">{names[code]}</span>
          </button>;
        })}
        {toggle.pending && <LoaderCircle className="self-center animate-spin text-[#718074]" size={17} aria-hidden="true" />}
      </div>
      {toggle.error && <p className="mt-3 text-sm text-[#b42318]" role="alert">{toggle.error}</p>}
    </div>

    {rates.length === 0 ? <p className="p-6 text-sm text-[#718074]">Only {primary} is accepted. Turn on another currency to set its rate.</p> :
      <div className="grid gap-px bg-[#eef1eb] lg:grid-cols-2">{rates.map((rate) => <RateCard countryId={countryId} key={rate.currency} primary={primary} rate={rate} />)}</div>}
  </section>;
}

function RateCard({ countryId, primary, rate }: { countryId: string; primary: string; rate: RateNow }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [foreign, setForeign] = useState("1");
  const [local, setLocal] = useState(rate.rateTenThousandths ? formatRate(rate.rateTenThousandths).replace(/,/g, "") : "");
  const current = rate.rateTenThousandths;
  const change = current && rate.previousTenThousandths ? ((current - rate.previousTenThousandths) / rate.previousTenThousandths) * 100 : null;
  // Converter: plain numbers for display only. Stored amounts always use the integer conversion.
  const toLocal = (text: string) => current && decimal.test(text) ? (Number(text) * current / 10_000).toFixed(2) : "";
  const toForeign = (text: string) => current && decimal.test(text) ? (Number(text) * 10_000 / current).toFixed(2) : "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (await run("/ops/currencies/rates", { countryId, currency: rate.currency, rate: value })) {
      setValue("");
      setSaved(true);
      router.refresh();
    }
  }

  return <div className="bg-white p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-[#718074]">{rate.currency} to {primary}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--kinja-green)]">{current ? <>1 {rate.currency} = {formatRate(current)} <span className="text-xl text-[#5d685e]">{primary}</span></> : "Not set"}</p>
        <p className="mt-1 text-sm text-[#5d685e]">{rate.since ? `Since ${since(rate.since)} · ${rate.setBy}` : `Amounts in ${rate.currency} show "—" until a rate is set.`}</p>
      </div>
      {change !== null && change !== 0 && <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", change > 0 ? "bg-[#fff5d9] text-[#8b6818]" : "bg-[#e7f6ef] text-[#1f6b45]")}>{change > 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>}
    </div>

    {current && <div className="mt-5 flex items-end gap-2 rounded-xl bg-[#f7f9f5] p-3">
      <label className="min-w-0 flex-1 text-xs font-medium text-[#718074]">{rate.currency}<input className={cn(inputClass, "mt-1 h-10 text-sm")} inputMode="decimal" onChange={(event) => { setForeign(event.target.value); setLocal(toLocal(event.target.value)); }} value={foreign} /></label>
      <ArrowLeftRight className="mb-2.5 shrink-0 text-[#9aa69c]" size={16} aria-hidden="true" />
      <label className="min-w-0 flex-1 text-xs font-medium text-[#718074]">{primary}<input className={cn(inputClass, "mt-1 h-10 text-sm")} inputMode="decimal" onChange={(event) => { setLocal(event.target.value); setForeign(toForeign(event.target.value)); }} value={local} /></label>
    </div>}

    <form className="mt-5" onSubmit={submit}>
      <label className="text-sm font-medium text-[#344e41]" htmlFor={`rate-${rate.currency}`}>New rate <span className="font-normal text-[#718074]">({primary} for 1 {rate.currency})</span></label>
      <div className="mt-2 flex gap-2">
        <input className={cn(inputClass, "mt-0")} id={`rate-${rate.currency}`} inputMode="decimal" min="0.0001" onChange={(event) => { setValue(event.target.value); setSaved(false); }} placeholder={current ? formatRate(current).replace(/,/g, "") : "e.g. 190.50"} required step="0.0001" type="number" value={value} />
        <button className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white disabled:opacity-60" disabled={pending || !parseRate(value)} type="submit">{pending ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}Save</button>
      </div>
      <p className="mt-2 text-xs text-[#718074]">Applies from now on. Earlier records keep the rate from their own date.</p>
      {error && <p className="mt-2 text-sm text-[#b42318]" role="alert">{error}</p>}
      {saved && !error && <p className="mt-2 text-sm font-medium text-[#1f6b45]" role="status">Rate saved.</p>}
    </form>
  </div>;
}
