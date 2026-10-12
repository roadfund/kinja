// One-off import of a hub's sales history from its Google Sheet into the production database.
//
//   pnpm import:sheet --sheet "<google sheet link>" --hub "Jimmy's Group"          (shows the plan)
//   pnpm import:sheet --sheet "<google sheet link>" --hub "Jimmy's Group" --yes    (writes)
//
// Reads DATABASE_URL from .env.production.local, else .env.local, else the environment. The hub must already
// exist and be verified: its admin signs up and onboards it, and the tech admin verifies it.
// Organizations the history needs (sales, production, farmers) are created if the hub has none;
// no user accounts are ever created here. Safe to run again: only new orders are added.
import { loadEnvFile } from "node:process";
import { createUuidV7 } from "@/domain/id";
import type { Organization, OrganizationType } from "@/domain/model";
import { importSalesHistory } from "@/dev/sales-import";
import { loadSheetTabs, sheetIdFrom } from "@/dev/sheet-source";
import { getRepository } from "@/repositories/server";

for (const file of [".env.production.local", ".env.local"]) { try { loadEnvFile(file); } catch { /* not there: try the next, or use the environment */ } }

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Put the Neon connection string in .env.production.local.");
  const sheet = arg("sheet") ?? process.env.KINJA_IMPORT_SHEET_URL;
  if (!sheet) throw new Error('Pass the sheet link: --sheet "https://docs.google.com/spreadsheets/d/..."');
  const write = process.argv.includes("--yes");
  const repository = getRepository();

  const hubs = (await repository.list("Hub")).filter((hub) => hub.status === "VERIFIED");
  const wanted = arg("hub")?.toLowerCase();
  const matches = wanted ? hubs.filter((hub) => hub.businessName.toLowerCase() === wanted) : hubs;
  if (matches.length !== 1) throw new Error(matches.length === 0 ? `No verified hub${wanted ? ` named "${arg("hub")}"` : ""}. Verified hubs: ${hubs.map((hub) => hub.businessName).join(", ") || "none yet (sign up, onboard the hub, and have the tech admin verify it)"}` : `Several verified hubs; choose one with --hub: ${matches.map((hub) => hub.businessName).join(", ")}`);
  const hub = matches[0];
  const memberships = (await repository.list("Membership", hub.id)).filter((membership) => membership.status === "ACTIVE");
  const hubAdmin = memberships.find((membership) => membership.role === "HUB_ADMIN");
  if (!hubAdmin) throw new Error(`${hub.businessName} has no active hub admin`);

  // Use the hub's own organizations, or name new ones after the hub.
  const organizations = await repository.list("Organization", hub.id);
  const now = new Date().toISOString();
  const created: Organization[] = [];
  const pick = (type: OrganizationType, suffix: string): Organization => {
    const found = organizations.find((organization) => organization.type === type && !organization.suspendedAt);
    if (found) return found;
    const organization: Organization = { id: createUuidV7(), hubId: hub.id, name: `${hub.businessName} ${suffix}`, type, createdById: hubAdmin.userId, createdAt: now, updatedAt: now };
    created.push(organization);
    return organization;
  };
  const distributor = pick("DISTRIBUTOR", "Sales");
  const manufacturer = pick("MANUFACTURER", "Production");
  const cooperative = pick("COOPERATIVE", "Farmers");
  const memberOf = (organization: Organization) => memberships.find((membership) => membership.organizationId === organization.id)?.userId ?? hubAdmin.userId;

  console.log(`Hub:          ${hub.businessName}`);
  console.log(`Sales by:     ${distributor.name}${created.includes(distributor) ? " (new)" : ""}`);
  console.log(`Made by:      ${manufacturer.name}${created.includes(manufacturer) ? " (new)" : ""}`);
  console.log(`Farmers from: ${cooperative.name}${created.includes(cooperative) ? " (new)" : ""}`);
  if (!write) return console.log("\nNothing written. Run again with --yes to import.");

  const { tabs, fromCache } = await loadSheetTabs(sheetIdFrom(sheet));
  if (created.length) await repository.putMany("Organization", created);
  const summary = await importSalesHistory(tabs, { hubId: hub.id, distributorId: distributor.id, manufacturerId: manufacturer.id, cooperativeId: cooperative.id, distributorUserId: memberOf(distributor), manufacturerUserId: memberOf(manufacturer) });
  console.log(`\nImported${fromCache ? " (from the saved copy)" : ""}: ${summary.orders} new orders (${summary.alreadyImported} already there), ${summary.customers} new customers, ${summary.invoices} invoices, ${summary.collections} payments, ${summary.rates} exchange rates.`);
  if (summary.orders) console.log(`Orders from ${summary.firstDate} to ${summary.lastDate}.`);
  if (summary.skipped.length) console.log(`Skipped: ${summary.skipped.join("; ")}`);
}

main().then(() => process.exit(0), (error: unknown) => { console.error(`\n${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
