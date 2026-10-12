import { countries } from "@/config/countries";

// Phone numbers are stored in international format (+231...). Local numbers
// starting with 0 get the country's dial code.
export function normalizePhone(raw: string, countryId: string): string {
  const country = countries.find((item) => item.id === countryId);
  const compact = raw.replace(/[\s().-]/g, "");
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (country && compact.startsWith("0")) return `${country.dialCode}${compact.slice(1)}`;
  return compact;
}

export function isValidPhone(phone: string, countryId: string): boolean {
  const country = countries.find((item) => item.id === countryId);
  return country ? new RegExp(country.phoneFormat).test(phone) : /^\+\d{8,15}$/.test(phone);
}

export function phoneExample(countryId: string): string {
  return countryId === "lr" ? "+231 77 000 0000" : "+000 000 000 000";
}
