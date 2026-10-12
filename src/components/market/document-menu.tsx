"use client";

import { FileText, ReceiptText } from "lucide-react";
import { RowMenu, RowMenuDownload } from "@/components/kinja/row-menu";

// "⋯" on a sale or invoice row: download its invoice, or a receipt once a payment is recorded.
export function DocumentMenu({ invoiceId, invoiceLabel, paid, voided }: { invoiceId?: string; invoiceLabel?: string; paid: boolean; voided?: boolean }) {
  const href = (type: "invoice" | "receipt") => `/market/invoices/${invoiceId}/document?type=${type}`;
  const noInvoice = voided ? "This sale was voided" : invoiceId ? undefined : "Issue an invoice first";
  return <RowMenu label={invoiceLabel ? `Documents for ${invoiceLabel}` : "Documents"}>
    <RowMenuDownload disabledReason={noInvoice} href={href("invoice")} icon={<FileText size={15} aria-hidden="true" />}>Download invoice{invoiceLabel && <span className="ml-1 font-normal text-[#718074]">{invoiceLabel}</span>}</RowMenuDownload>
    <RowMenuDownload disabledReason={noInvoice ?? (paid ? undefined : "No payment recorded yet")} href={href("receipt")} icon={<ReceiptText size={15} aria-hidden="true" />}>Download receipt</RowMenuDownload>
  </RowMenu>;
}
