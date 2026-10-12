import type { Role } from "@/domain/model";

export const roleLabels: Record<Role, string> = {
  TECH_ADMIN: "Tech admin",
  HUB_ADMIN: "Hub admin",
  COOP_LEAD: "Cooperative lead",
  FIELD_STAFF: "Field staff",
  MANUFACTURER: "Manufacturer",
  DISTRIBUTOR: "Distributor",
};

function nameParts(fullName: string): string[] {
  return fullName.trim().split(/\s+/).filter(Boolean);
}

export function firstName(fullName: string): string {
  return nameParts(fullName)[0] ?? "";
}

export function initials(fullName: string): string {
  const parts = nameParts(fullName);
  if (parts.length === 0) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${parts[0][0]}${last}`.toUpperCase();
}
