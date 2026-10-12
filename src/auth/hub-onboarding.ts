import { z } from "zod";
import { africanCountryOptions, countries } from "@/config/countries";
import { isValidPhone, normalizePhone } from "@/config/phone";

export const businessCategories = ["Agro-processor", "Cooperative union", "Exporter or off-taker", "Development program", "Other"] as const;
// Uploads are stored as data URLs until file storage exists, so keep them small.
export const MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_CERTIFICATE_BYTES * 4) / 3) + 100;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const HubOnboardingInput = z.object({
  businessName: z.string().trim().min(2).max(120),
  businessCategory: z.enum(businessCategories),
  yearEstablished: z.coerce.number().int().min(1900).max(new Date().getUTCFullYear()),
  countryId: z.string().min(1),
  regionOrCounty: z.string().trim().min(1),
  physicalAddress: z.string().trim().min(3).max(200),
  gps: z.union([z.literal(""), z.string().regex(/^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/)]).optional().transform((value) => value || undefined),
  registrationNumber: z.string().trim().min(2).max(60),
  registrationCertificateUrl: z.string().regex(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/, "Upload the registration certificate as a PDF or image").max(MAX_DATA_URL_LENGTH, "The certificate must be smaller than 2MB"),
  taxId: optionalText(60),
  contactName: z.string().trim().min(2).max(100),
  contactTitle: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().min(7),
  contactEmail: z.string().trim().email(),
  approximateFarmerCount: z.coerce.number().int().min(0).max(10_000_000),
  approximateCooperativeCount: z.coerce.number().int().min(0).max(100_000),
  logoUrl: z.union([z.literal(""), z.string().startsWith("data:image/").max(300_000)]).optional().transform((value) => value || undefined),
  websiteOrSocialPage: z.union([z.literal(""), z.string().trim().url("Enter a full web address, starting with https://")]).optional().transform((value) => value || undefined),
});
export type HubOnboarding = z.infer<typeof HubOnboardingInput>;

export function onboardingCountries() {
  return countries.map((country) => ({ id: country.id, name: country.name, dialCode: country.dialCode, regions: africanCountryOptions.find((option) => option.code === country.code)?.regions ?? [] }));
}

// Validates everything a new hub submits, against the country configuration. Crops are
// chosen later, in hub setup, not during onboarding.
export async function validateHubOnboarding(input: unknown): Promise<HubOnboarding> {
  const details = HubOnboardingInput.parse(input);
  const country = onboardingCountries().find((item) => item.id === details.countryId);
  if (!country) throw new Error("Choose a country Kinja operates in");
  if (country.regions.length && !(country.regions as readonly string[]).includes(details.regionOrCounty)) throw new Error("Choose a region or county from the list");
  const contactPhone = normalizePhone(details.contactPhone, country.id);
  if (!isValidPhone(contactPhone, country.id)) throw new Error("The contact phone is not a valid number for this country");
  return { ...details, contactPhone };
}
