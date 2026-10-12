import { NextResponse } from "next/server";
import { devToolsNotFound } from "@/dev/guard";
import { demoImportTarget, importSalesHistory } from "@/dev/sales-import";
import { loadSeedData } from "@/dev/seed";
import { loadSheetTabs, sheetIdFrom } from "@/dev/sheet-source";

// Replaces the demo data with the base demo (people, hub, supply chain) plus the sales
// history from the given Google Sheet.
export async function POST(request: Request) {
  const blocked = devToolsNotFound();
  if (blocked) return blocked;
  try {
    const sheetId = sheetIdFrom(String((await request.formData()).get("sheet") ?? ""));
    const { tabs, fromCache } = await loadSheetTabs(sheetId);
    await loadSeedData({ withSampleSales: false });
    const summary = await importSalesHistory(tabs, await demoImportTarget());
    const params = new URLSearchParams({ done: "imported", orders: String(summary.orders), customers: String(summary.customers), invoices: String(summary.invoices), from: summary.firstDate, to: summary.lastDate, cached: fromCache ? "1" : "", skipped: summary.skipped.slice(0, 5).join("; ") });
    return NextResponse.redirect(new URL(`/dev?${params}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/dev?${new URLSearchParams({ done: "import-failed", error: error instanceof Error ? error.message : String(error) })}`, request.url), 303);
  }
}
