import type { Account } from "@/auth/server-store";
import { getMoneyContext } from "@/admin/exchange-rates";
import { formatRate, moneyItem, moneyLines, rateAt, type MoneyContext } from "@/domain/currency";
import type { Collection, Customer, Hub } from "@/domain/model";
import { formatMoney, formatQuantity, toThousandths } from "@/domain/money";
import { getInvoiceDetail, saleNetMinor, type InvoiceRow, type SaleRow } from "@/market/market-service";
import { A4, hex, PdfCanvas, textWidth } from "@/ops/pdf-canvas";

export type DocumentKind = "invoice" | "receipt";

const GREEN = hex("#344e41");
const INK = hex("#1f2a22");
const MUTED = hex("#718074");
const LINE = hex("#dce2d9");
const SOFT = hex("#f7f9f5");
const CREAM = hex("#f4f1e8");
const YELLOW = hex("#e8b44d");
const WHITE = hex("#ffffff");
const RED = hex("#9b2c1f");
const PAID = hex("#1f6b45");

const LEFT = 40;
const RIGHT = A4.width - 40;
const WIDTH = RIGHT - LEFT;
const methods: Record<Collection["method"], string> = { MOBILE_MONEY: "Mobile money", CASH: "Cash", BANK_TRANSFER: "Bank transfer" };
const statusLabels: Record<InvoiceRow["status"], [string, [number, number, number]]> = { ISSUED: ["Issued", GREEN], PARTIALLY_PAID: ["Partly paid", hex("#8b6818")], PAID: ["Paid", PAID], OVERDUE: ["Overdue", RED], VOID: ["Void", MUTED] };
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const initials = (name: string) => name.split(/\s+/).filter((part) => /^[A-Za-z]/.test(part)).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "K";

type Detail = { invoice: InvoiceRow; sales: SaleRow[]; collections: Collection[]; customer?: Customer };

// Builds the invoice or receipt PDF for an invoice the account can see (its distributor or the hub admin).
export async function buildInvoiceDocument(account: Account, invoiceId: string, kind: DocumentKind, now = new Date()): Promise<{ fileName: string; bytes: Uint8Array } | null> {
  const detail = await getInvoiceDetail(account, invoiceId, now);
  if (!detail) return null;
  const hub = account.hub!;
  const money = await getMoneyContext(hub);
  const live = detail.collections.filter((collection) => !collection.voidedAt);
  if (kind === "receipt" && live.length === 0) throw new Error("No payment has been recorded on this invoice yet");
  const bytes = renderDocument(kind, { ...detail, collections: live }, hub, money, now);
  const number = kind === "invoice" ? detail.invoice.label : detail.invoice.label.replace("INV", "RCT");
  return { fileName: `${number}-${detail.invoice.customerName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + ".pdf", bytes };
}

export function renderDocument(kind: DocumentKind, { invoice, sales, collections, customer }: Detail, hub: Pick<Hub, "businessName" | "physicalAddress" | "regionOrCounty" | "contactPerson">, money: MoneyContext, now: Date): Uint8Array {
  const pdf = new PdfCanvas();
  const isReceipt = kind === "receipt";
  const currency = invoice.currency;
  const fmt = (minor: number) => formatMoney(minor, currency).replace(/\s/g, " ");
  const receivedMinor = collections.reduce((sum, collection) => sum + collection.amountMinor, 0);
  const paidInFull = invoice.outstandingMinor === 0 && invoice.status !== "VOID";

  // ---- Header: brand mark, hub, and the document title on the right ----
  pdf.rect(0, 0, A4.width, 6, { fill: GREEN });
  pdf.rect(LEFT, 36, 40, 40, { fill: GREEN });
  pdf.text(LEFT + 20, 49, initials(hub.businessName), { size: 15, bold: true, color: WHITE, align: "center" });
  pdf.text(LEFT + 52, 36, hub.businessName, { size: 17, bold: true, color: GREEN, maxWidth: 270 });
  pdf.text(LEFT + 52, 58, `Sold by ${invoice.distributorName}`, { size: 9, color: MUTED, maxWidth: 270 });
  pdf.text(LEFT + 52, 70, [hub.physicalAddress, hub.regionOrCounty].filter(Boolean).join(", "), { size: 9, color: MUTED, maxWidth: 270 });
  pdf.text(LEFT, 90, [hub.contactPerson.phone, hub.contactPerson.email].filter(Boolean).join("   ·   "), { size: 9, color: MUTED });

  pdf.text(RIGHT, 34, isReceipt ? "RECEIPT" : "INVOICE", { size: 26, bold: true, color: GREEN, align: "right" });
  pdf.text(RIGHT, 66, isReceipt ? `${invoice.label.replace("INV", "RCT")}  ·  for ${invoice.label}` : invoice.label, { size: 11, bold: true, color: INK, align: "right" });
  const [statusText, statusColor] = isReceipt ? [paidInFull ? "Paid in full" : "Part payment", paidInFull ? PAID : hex("#8b6818")] as const : statusLabels[invoice.status];
  const pillWidth = textWidth(statusText, 8.5, true) + 18;
  pdf.rect(RIGHT - pillWidth, 84, pillWidth, 17, { fill: statusColor });
  pdf.text(RIGHT - pillWidth / 2, 88.5, statusText, { size: 8.5, bold: true, color: WHITE, align: "center" });

  pdf.line(LEFT, 116, RIGHT, 116, LINE);

  // ---- Who and when ----
  const label = (x: number, top: number, value: string) => pdf.text(x, top, value.toUpperCase(), { size: 7.5, bold: true, color: MUTED });
  label(LEFT, 132, isReceipt ? "Received from" : "Bill to");
  pdf.text(LEFT, 146, invoice.customerName, { size: 12, bold: true, color: INK, maxWidth: 220 });
  [customer?.phone, customer?.email, customer?.address].filter((line): line is string => Boolean(line)).forEach((line, index) => pdf.text(LEFT, 164 + index * 13, line, { size: 9, color: MUTED, maxWidth: 220 }));

  const metaX = 300;
  const meta: Array<[string, string]> = isReceipt
    ? [["Receipt date", day(collections[0]?.receivedAt ?? now.toISOString())], ["Invoice date", day(invoice.issuedAt)], ["Currency", currency]]
    : [["Issue date", day(invoice.issuedAt)], ["Due date", day(invoice.dueDate)], ["Currency", currency]];
  meta.forEach(([name, value], index) => {
    label(metaX + (index % 2) * 130, 132 + Math.floor(index / 2) * 34, name);
    pdf.text(metaX + (index % 2) * 130, 145 + Math.floor(index / 2) * 34, value, { size: 10.5, bold: true, color: INK });
  });

  let top = 216;
  const ensure = (needed: number) => { if (top + needed > A4.height - 60) { pdf.newPage(); pdf.rect(0, 0, A4.width, 6, { fill: GREEN }); top = 40; } };

  // ---- Items (invoice) or payments (receipt) table ----
  const table = <T,>(columns: Array<{ title: string; x: number; align?: "right"; width?: number }>, rows: T[], cells: (row: T) => Array<{ text: string; sub?: string; bold?: boolean }>) => {
    const header = () => {
      pdf.rect(LEFT, top, WIDTH, 24, { fill: GREEN });
      columns.forEach((column) => pdf.text(column.x, top + 8.5, column.title.toUpperCase(), { size: 7.5, bold: true, color: WHITE, align: column.align }));
      top += 24;
    };
    header();
    rows.forEach((row, index) => {
      const values = cells(row);
      const height = values.some((value) => value.sub) ? 34 : 26;
      if (top + height > A4.height - 60) { pdf.newPage(); pdf.rect(0, 0, A4.width, 6, { fill: GREEN }); top = 40; header(); }
      if (index % 2 === 1) pdf.rect(LEFT, top, WIDTH, height, { fill: SOFT });
      values.forEach((value, column) => {
        const spec = columns[column];
        pdf.text(spec.x, top + 8, value.text, { size: 9.5, bold: value.bold, color: INK, align: spec.align, maxWidth: spec.width });
        if (value.sub) pdf.text(spec.x, top + 21, value.sub, { size: 7.5, color: MUTED, align: spec.align, maxWidth: spec.width });
      });
      top += height;
      pdf.line(LEFT, top, RIGHT, top, LINE, 0.5);
    });
  };

  if (!isReceipt) {
    table([{ title: "Item", x: LEFT + 12, width: 200 }, { title: "Qty", x: 330, align: "right" }, { title: "Unit price", x: 410, align: "right" }, { title: "Discount", x: 475, align: "right" }, { title: "Amount", x: RIGHT - 12, align: "right" }], sales, (sale) => [
      { text: sale.productName, bold: true, sub: [`Batch ${sale.batchLabel}`, sale.orderLabel, day(sale.soldAt)].filter(Boolean).join("  ·  ") },
      { text: formatQuantity(toThousandths(sale.quantity), sale.unit) },
      { text: fmt(sale.unitPriceMinor) },
      { text: sale.discountMinor ? `-${fmt(sale.discountMinor)}` : "-" },
      { text: fmt(saleNetMinor(sale)), bold: true },
    ]);
  } else {
    table([{ title: "Date", x: LEFT + 12 }, { title: "Method", x: 160 }, { title: "Reference", x: 270, width: 160 }, { title: "Amount", x: RIGHT - 12, align: "right" }], collections, (collection) => [
      { text: day(collection.receivedAt) },
      { text: methods[collection.method] },
      { text: collection.reference ?? "-" },
      { text: fmt(collection.amountMinor), bold: true },
    ]);
  }

  // ---- Totals box ----
  top += 18;
  ensure(150);
  const boxX = 330;
  const gross = sales.reduce((sum, sale) => sum + sale.amountMinor, 0);
  const discount = sales.reduce((sum, sale) => sum + (sale.discountMinor ?? 0), 0);
  const rows: Array<[string, string, boolean?]> = isReceipt
    ? [["Invoice total", fmt(invoice.totalMinor)], ["Received", fmt(receivedMinor)]]
    : [["Subtotal", fmt(gross)], ...(discount ? [["Discount", `-${fmt(discount)}`] as [string, string]] : []), ["Total", fmt(invoice.totalMinor), true], ["Paid", fmt(invoice.collectedMinor)]];
  const boxTop = top;
  rows.forEach(([name, value, strong]) => {
    pdf.text(boxX + 12, top, name, { size: strong ? 10.5 : 9.5, bold: strong, color: strong ? INK : MUTED });
    pdf.text(RIGHT - 12, top, value, { size: strong ? 10.5 : 9.5, bold: true, color: INK, align: "right" });
    top += strong ? 20 : 17;
  });
  top += 4;
  const due = invoice.status === "VOID" ? 0 : invoice.outstandingMinor;
  pdf.rect(boxX, top, RIGHT - boxX, 34, { fill: due === 0 ? hex("#e7f6ef") : CREAM });
  pdf.rect(boxX, top, 4, 34, { fill: due === 0 ? PAID : YELLOW });
  pdf.text(boxX + 14, top + 11, isReceipt ? "Balance remaining" : "Balance due", { size: 10, bold: true, color: INK });
  pdf.text(RIGHT - 12, top + 9.5, fmt(due), { size: 14, bold: true, color: due === 0 ? PAID : GREEN, align: "right" });
  top += 44;
  // The same figures in the country's other currencies, at the rate on the invoice date.
  const others = moneyLines(money, moneyItem(isReceipt ? receivedMinor : invoice.totalMinor, currency, invoice.issuedAt)).slice(1);
  others.forEach((line) => {
    const rate = rateAt(money, line.currency === money.primary ? currency : line.currency, invoice.issuedAt);
    const rateNote = rate ? `1 ${line.currency === money.primary ? currency : line.currency} = ${formatRate(rate)} ${money.primary}` : "no rate set";
    pdf.text(RIGHT - 12, top, `Equals ${line.text.replace(/\s/g, " ")}  ·  ${rateNote} on ${day(invoice.issuedAt)}`, { size: 8, color: MUTED, align: "right" });
    top += 12;
  });

  // Left of the totals: how to pay, or a thank-you on receipts.
  pdf.text(LEFT, boxTop, isReceipt ? "Thank you for your payment." : "How to pay", { size: 10, bold: true, color: GREEN });
  const notes = isReceipt
    ? [`This receipt confirms ${fmt(receivedMinor)} received`, `against invoice ${invoice.label}.`, paidInFull ? "The invoice is now paid in full." : `${fmt(due)} is still to be paid.`]
    : ["Mobile money, cash or bank transfer.", `Please quote ${invoice.label} with your payment.`, `Due by ${day(invoice.dueDate)}.`];
  notes.forEach((note, index) => pdf.text(LEFT, boxTop + 17 + index * 13, note, { size: 9, color: MUTED, maxWidth: 270 }));

  if (isReceipt && paidInFull) pdf.stamp(LEFT + 24, boxTop + 128, "PAID", PAID, 34, 12);
  if (invoice.status === "VOID") pdf.stamp(LEFT + 24, boxTop + 128, "VOID", RED, 34, 12);

  return pdf.toBytes((page, count) => `${hub.businessName}  ·  ${isReceipt ? `Receipt ${invoice.label.replace("INV", "RCT")}` : `Invoice ${invoice.label}`}  ·  Generated by Kinja on ${day(now.toISOString())}.${count > 1 ? `  ·  Page ${page} of ${count}` : ""}`);
}
