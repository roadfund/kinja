import { History } from "lucide-react";
import { currencyNames, listCurrencySettings, SUPPORTED_EXTRA_CURRENCIES } from "@/admin/exchange-rates";
import { requireDashboardRole } from "@/auth/route-authorization";
import { Badge, DashboardShell, DataTable, EmptyState, SectionHeader } from "@/components/kinja/ui";
import { formatRate } from "@/domain/currency";
import { CurrencyPanel } from "./currency-panel";

export default async function CurrenciesPage() {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const countries = await listCurrencySettings(account);
  const history = countries.flatMap((country) => country.history.map((rate) => ({ ...rate, countryName: country.countryName, primary: country.primary }))).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return <DashboardShell eyebrow="Platform settings" title="Currencies" description="Choose which currencies each country accepts and set their exchange rates. Every amount on Kinja is shown in each accepted currency, converted at the rate in force on the day it was recorded.">
    <div className="space-y-6">{countries.map((country) => {
      const previous = (currency: string) => country.history.find((rate) => rate.currency === currency)?.previousTenThousandths;
      return <CurrencyPanel countryId={country.countryId} countryName={country.countryName} currencies={country.currencies} key={country.countryId} names={currencyNames} primary={country.primary} rates={country.current.map((rate) => ({ currency: rate.currency, rateTenThousandths: rate.rateTenThousandths, previousTenThousandths: previous(rate.currency), since: rate.effectiveFrom, setBy: rate.setBy }))} supported={[...SUPPORTED_EXTRA_CURRENCIES]} />;
    })}</div>

    <SectionHeader description="Newest first. Rates are never edited, only replaced, so past amounts never change." title="Rate history" />
    {history.length === 0 ? <EmptyState description="Rates you set appear here." icon={<History size={22} aria-hidden="true" />} title="No rates yet" /> :
      <DataTable rowKey={(rate) => rate.id} rows={history} columns={[
        { header: "From", cell: (rate) => <span className="whitespace-nowrap">{new Date(rate.effectiveFrom).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span> },
        { header: "Country", cell: (rate) => rate.countryName },
        { header: "Rate", cell: (rate) => <span className="font-semibold text-[var(--kinja-green)]">1 {rate.currency} = {formatRate(rate.rateTenThousandths)} {rate.primary}</span> },
        { header: "Change", cell: (rate) => { if (!rate.previousTenThousandths) return <Badge tone="grey">First rate</Badge>; const change = ((rate.rateTenThousandths - rate.previousTenThousandths) / rate.previousTenThousandths) * 100; return <Badge tone={change > 0 ? "amber" : change < 0 ? "green" : "grey"}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</Badge>; } },
        { header: "Set by", cell: (rate) => rate.setBy },
      ]} />}
  </DashboardShell>;
}
