import { z } from "zod";
import { requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { countries } from "@/config/countries";
import { parseRate, type MoneyContext } from "@/domain/currency";
import { createUuidV7 } from "@/domain/id";
import type { Country, CurrencySetting, ExchangeRate, Hub } from "@/domain/model";
import { writeAuditLog } from "@/ops/audit";
import { getRepository } from "@/repositories/server";

// Currencies a tech admin can accept next to a country's own.
export const SUPPORTED_EXTRA_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export const currencyNames: Record<string, string> = { LRD: "Liberian dollar", USD: "US dollar", EUR: "Euro", GBP: "British pound" };

export function countryFor(hub: Pick<Hub, "countryId">) {
  return countries.find((country) => country.id === hub.countryId);
}

// A country's currencies, main first: the tech admin's setting, or the country's defaults.
async function countryCurrencies(country: Country): Promise<string[]> {
  const setting = await getRepository().get("CurrencySetting", country.id);
  const extras = setting ? setting.extraCurrencies : country.currencies.filter((code) => code !== country.currency);
  return [country.currency, ...extras.filter((code) => code !== country.currency)];
}

// What every money display needs: the hub's currencies and its country's rate history.
export async function getMoneyContext(hub: Pick<Hub, "countryId">): Promise<MoneyContext> {
  const country = countryFor(hub);
  const primary = country?.currency ?? "LRD";
  const rates = (await getRepository().list("ExchangeRate")).filter((rate) => rate.countryId === hub.countryId).map(({ currency, rateTenThousandths, effectiveFrom }) => ({ currency, rateTenThousandths, effectiveFrom }));
  return { primary, currencies: country ? await countryCurrencies(country) : [primary], rates };
}

// ---- Tech admin: currency settings -------------------------------------------

export type CountryCurrencyOverview = {
  countryId: string; countryName: string; primary: string; currencies: string[];
  current: Array<{ currency: string; rateTenThousandths?: number; effectiveFrom?: string; setBy?: string }>;
  history: Array<ExchangeRate & { setBy: string; previousTenThousandths?: number }>;
};

export async function listCurrencySettings(account: Account): Promise<CountryCurrencyOverview[]> {
  requireRole(account, ["TECH_ADMIN"]);
  const [rates, users] = await Promise.all([getRepository().list("ExchangeRate"), getRepository().list("User")]);
  const userName = (id: string) => users.find((user) => user.id === id)?.fullName ?? "Kinja";
  return Promise.all(countries.map(async (country) => {
    const currencies = await countryCurrencies(country);
    const countryRates = rates.filter((rate) => rate.countryId === country.id).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    const history = countryRates.map((rate) => ({ ...rate, setBy: userName(rate.createdById), previousTenThousandths: countryRates.find((older) => older.currency === rate.currency && older.effectiveFrom < rate.effectiveFrom)?.rateTenThousandths }));
    const current = currencies.slice(1).map((currency) => {
      const latest = countryRates.find((rate) => rate.currency === currency);
      return { currency, rateTenThousandths: latest?.rateTenThousandths, effectiveFrom: latest?.effectiveFrom, setBy: latest ? userName(latest.createdById) : undefined };
    });
    return { countryId: country.id, countryName: country.name, primary: country.currency, currencies, current, history };
  }));
}

export const CountryCurrenciesInput = z.object({ countryId: z.string().min(1), extraCurrencies: z.array(z.enum(SUPPORTED_EXTRA_CURRENCIES)).max(3) });

// Turning a currency off stops new records in it; existing records keep showing in it.
export async function setCountryCurrencies(account: Account, input: unknown, now = new Date()): Promise<CurrencySetting> {
  const scope = requireRole(account, ["TECH_ADMIN"]);
  const details = CountryCurrenciesInput.parse(input);
  const country = countries.find((item) => item.id === details.countryId);
  if (!country) throw new Error("Unknown country");
  const timestamp = now.toISOString();
  const existing = await getRepository().get("CurrencySetting", country.id);
  const setting: CurrencySetting = { id: country.id, countryId: country.id, extraCurrencies: [...new Set(details.extraCurrencies)].filter((code) => code !== country.currency), createdById: existing?.createdById ?? scope.userId, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
  await getRepository().put("CurrencySetting", setting);
  await writeAuditLog({ actorId: scope.userId, action: "SET_CURRENCIES", entity: "CurrencySetting", entityId: country.id, reason: `${country.name}: ${[country.currency, ...setting.extraCurrencies].join(", ")}` }, now);
  return setting;
}

export const ExchangeRateInput = z.object({
  countryId: z.string().min(1),
  currency: z.string().length(3),
  rate: z.string().trim().min(1),
});

// Only the tech admin sets rates. A new rate applies from now on; earlier records keep theirs.
export async function setExchangeRate(account: Account, input: unknown, now = new Date()): Promise<ExchangeRate> {
  const scope = requireRole(account, ["TECH_ADMIN"]);
  const details = ExchangeRateInput.parse(input);
  const country = countries.find((item) => item.id === details.countryId);
  if (!country) throw new Error("Unknown country");
  if (details.currency === country.currency || !(await countryCurrencies(country)).includes(details.currency)) throw new Error(`Turn on ${details.currency} for ${country.name} before setting its rate`);
  const rateTenThousandths = parseRate(details.rate);
  if (!rateTenThousandths) throw new Error("Enter the rate as a number, e.g. 190.50");
  const timestamp = now.toISOString();
  const rate: ExchangeRate = { id: createUuidV7(), countryId: country.id, currency: details.currency, rateTenThousandths, effectiveFrom: timestamp, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("ExchangeRate", rate);
  await writeAuditLog({ actorId: scope.userId, action: "SET_RATE", entity: "ExchangeRate", entityId: rate.id, reason: `1 ${rate.currency} = ${details.rate} ${country.currency}` }, now);
  return rate;
}
