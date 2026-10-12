import type { Country } from "@/domain/model";

export const countries: Country[] = [{
  id: "lr", code: "LR", name: "Liberia", currency: "LRD", currencies: ["LRD", "USD"], defaultLanguage: "en", timeZone: "Africa/Monrovia", dialCode: "+231", phoneFormat: "^\\+231[0-9]{7,9}$", enabledMobileMoneyProviders: ["MTN_MOMO", "ORANGE_MONEY"],
}];

export const africanCountryOptions = [
  { code: "LR", name: "Liberia", flag: "🇱🇷", regions: ["Bomi", "Bong", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh", "Grand Kru", "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba", "River Cess", "River Gee", "Sinoe"] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", regions: ["Ashanti", "Central", "Greater Accra", "Northern", "Upper East", "Upper West", "Volta", "Western"] },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", regions: ["Abuja Federal Capital Territory", "Kano", "Lagos", "Nasarawa", "Ogun", "Oyo", "Rivers"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", regions: ["Baringo", "Kakamega", "Kiambu", "Kisumu", "Machakos", "Nairobi", "Nakuru"] },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", regions: ["Eastern", "Kigali", "Northern", "Southern", "Western"] },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱", regions: ["Eastern", "Northern", "North Western", "Southern", "Western Area"] },
  { code: "SN", name: "Senegal", flag: "🇸🇳", regions: ["Dakar", "Diourbel", "Kaolack", "Saint-Louis", "Thiès", "Ziguinchor"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", regions: ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Western Cape"] },
  { code: "UG", name: "Uganda", flag: "🇺🇬", regions: ["Central", "Eastern", "Northern", "Western"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", regions: ["Arusha", "Dar es Salaam", "Dodoma", "Mwanza", "Morogoro", "Mbeya"] },
] as const;

export type AfricanCountryCode = (typeof africanCountryOptions)[number]["code"];