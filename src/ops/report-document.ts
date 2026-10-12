import { formatDual, moneyItem, type MoneyContext } from "@/domain/currency";
import { formatQuantity, toThousandths } from "@/domain/money";
import type { MonthlyReport } from "@/domain/model";
import type { PdfSection } from "@/ops/pdf";

// The four sections of a monthly report as label/value rows, shared by the page, PDF and CSV.
export function reportSections(report: MonthlyReport, context: MoneyContext): Array<{ title: string; rows: Array<[string, string]> }> {
  const { data } = report;
  // Each amount in the main currency, with the other currencies alongside.
  const money = (minor: number) => formatDual(context, moneyItem(minor, data.currency, `${report.month}-28T12:00:00.000Z`));
  const kg = (value: string) => formatQuantity(toThousandths(value), "KG");
  return [
    { title: "Financial", rows: [["Sales", money(data.financial.salesMinor)], ["Invoiced", money(data.financial.invoicedMinor)], ["Collected", money(data.financial.collectedMinor)], ["Paid to farmers", money(data.financial.paidToFarmersMinor)]] },
    { title: "Operations", rows: [["Raw material received", kg(data.operations.receivedKg)], ["Produced (kg)", kg(data.operations.producedKg)], ["Produced (units)", formatQuantity(toThousandths(data.operations.producedUnits), "UNIT")], ["Wastage", kg(data.operations.wastageKg)], ["Average yield", data.operations.averageYieldPercent === null ? "-" : `${data.operations.averageYieldPercent}%`], ["Transfer discrepancies", String(data.operations.discrepancies)]] },
    { title: "Farmers", rows: [["New registrations", String(data.farmers.newRegistrations)], ["Active farmers", String(data.farmers.activeFarmers)], ["Deliveries", String(data.farmers.deliveries)], ["Payouts", String(data.farmers.payouts)]] },
    { title: "Sales", rows: [...data.sales.byCustomer.map(({ name, amountMinor }): [string, string] => [`Customer: ${name}`, money(amountMinor)]), ...data.sales.byProduct.map(({ name, amountMinor, quantity }): [string, string] => [`Product: ${name} (${quantity ?? "0"})`, money(amountMinor)]), ["Overdue invoices", `${data.sales.overdueInvoices} (${money(data.sales.overdueMinor)})`]] },
  ];
}

export function reportPdfSections(report: MonthlyReport, context: MoneyContext): PdfSection[] {
  return reportSections(report, context).map((section) => ({ heading: section.title, table: { headers: ["Measure", "Value"], rows: section.rows } }));
}
