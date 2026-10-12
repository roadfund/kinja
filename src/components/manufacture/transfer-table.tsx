import { Truck } from "lucide-react";
import { Badge, EmptyState, formatDate } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { formatQuantity, toThousandths } from "@/domain/money";
import type { TransferRow } from "@/manufacture/manufacture-service";
import { ReceiveTransferButton } from "./receive-transfer-button";

export function TransferStatusBadge({ transfer }: { transfer: TransferRow }) {
  if (transfer.voidedAt) return <Badge tone="grey">Voided</Badge>;
  if (transfer.status === "SENT") return <Badge tone="amber">Awaiting receipt</Badge>;
  return transfer.hasDiscrepancy ? <Badge tone="red">Discrepancy</Badge> : <Badge tone="green">Received</Badge>;
}

// One table for every side of a transfer. The receiver gets a confirm button on transfers still in transit.
export function TransferTable({ transfers, canReceive = false, emptyText }: { transfers: TransferRow[]; canReceive?: boolean; emptyText: string }) {
  if (transfers.length === 0) return <EmptyState description={emptyText} icon={<Truck size={22} aria-hidden="true" />} title="No transfers yet" />;
  return <DataTable muted={(transfer) => Boolean(transfer.voidedAt)} rowKey={(transfer) => transfer.id} rows={transfers} columns={[
    { header: "Sent", cell: (transfer) => formatDate(transfer.createdAt) },
    { header: "From", cell: (transfer) => <span className="font-medium text-[#344e41]">{transfer.fromName}</span> },
    { header: "To", cell: (transfer) => <span className="font-medium text-[#344e41]">{transfer.toName}</span> },
    { header: "Goods", cell: (transfer) => transfer.itemName },
    { header: "Deliveries", cell: (transfer) => (transfer.kind === "RAW_MATERIAL" ? transfer.deliveryIds.length : "—") },
    { header: "Sent qty", align: "right", cell: (transfer) => formatQuantity(toThousandths(transfer.quantitySent), transfer.unit) },
    { header: "Received qty", align: "right", cell: (transfer) => (transfer.quantityReceived ? <span className={transfer.hasDiscrepancy ? "font-semibold text-[#b42318]" : ""}>{formatQuantity(toThousandths(transfer.quantityReceived), transfer.unit)}</span> : "—") },
    { header: "Status", cell: (transfer) => <TransferStatusBadge transfer={transfer} /> },
    { header: "Note", cell: (transfer) => transfer.voidReason ? `Voided: ${transfer.voidReason}` : transfer.note ?? "—" },
    ...(canReceive ? [{ header: "Action", cell: (transfer: TransferRow) => transfer.direction === "IN" && transfer.status === "SENT" && !transfer.voidedAt ? <ReceiveTransferButton fromName={transfer.fromName} quantitySent={transfer.quantitySent} transferId={transfer.id} unitLabel={transfer.unit === "KG" ? "kg" : "units"} /> : null }] : []),
  ]} />;
}

export function transferSummary(transfers: TransferRow[]) {
  const live = transfers.filter((transfer) => !transfer.voidedAt);
  return {
    inTransit: live.filter((transfer) => transfer.status === "SENT").length,
    received: live.filter((transfer) => transfer.status === "RECEIVED").length,
    discrepancies: live.filter((transfer) => transfer.hasDiscrepancy).length,
    total: live.length,
  };
}
