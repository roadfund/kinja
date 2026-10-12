import { toThousandths } from "@/domain/money";
import { getRepository } from "@/repositories/server";
import { inPeriod } from "@/ops/reporting-scope";

export type ImpactFilters = { from?: string; to?: string; cooperativeId?: string };

export type ImpactReport = {
  farmersRegistered: number;
  farmersReached: number;
  womenReached: number;
  womenShare: number | null;
  deliveries: number;
  deliveredThousandths: number;
  amountOwedMinor: number;
  totalPaidMinor: number;
  averageDaysToPayout: number | null;
  rawReceivedThousandths: number;
  tracedRawThousandths: number;
  localSourcingShare: number | null;
  byCropAndGrade: Array<{ cropName: string; gradeName: string; deliveries: number; thousandths: number; amountOwedMinor: number }>;
};

// Impact for one hub, filtered by period and cooperative. Authorization happens
// in the caller (see resolveReportingHub), which decides the hub.
export async function computeImpact(hubId: string, filters: ImpactFilters = {}): Promise<ImpactReport> {
  const repository = getRepository();
  const [farmers, deliveries, transfers, crops, hubCrops, payouts] = await Promise.all([repository.list("Farmer", hubId), repository.list("Delivery", hubId), repository.list("Transfer", hubId), repository.list("Crop"), repository.list("HubCrop", hubId), repository.list("Payout", hubId)]);
  const inCooperative = (cooperativeId: string) => !filters.cooperativeId || cooperativeId === filters.cooperativeId;
  const scopedDeliveries = deliveries.filter((delivery) => !delivery.voidedAt && inCooperative(delivery.cooperativeId) && inPeriod(delivery.createdAt, filters.from, filters.to));
  const farmersById = new Map(farmers.map((farmer) => [farmer.id, farmer]));
  const reached = [...new Set(scopedDeliveries.map((delivery) => delivery.farmerId))];
  const womenReached = reached.filter((id) => farmersById.get(id)?.gender === "FEMALE").length;

  const raw = transfers.filter((transfer) => !transfer.voidedAt && transfer.kind === "RAW_MATERIAL" && transfer.status === "RECEIVED" && inCooperative(transfer.fromOrganizationId) && inPeriod(transfer.receivedAt!, filters.from, filters.to));
  const rawReceivedThousandths = raw.reduce((sum, transfer) => sum + toThousandths(transfer.quantityReceived!), 0);
  const tracedRawThousandths = raw.filter((transfer) => transfer.deliveryIds.some((id) => farmersById.has(deliveries.find((delivery) => delivery.id === id)?.farmerId ?? ""))).reduce((sum, transfer) => sum + toThousandths(transfer.quantityReceived!), 0);

  // Kinja Pay is not built yet, so payouts are counted when they exist.
  const succeeded = payouts.filter((payout) => payout.status === "SUCCEEDED" && inPeriod(payout.updatedAt, filters.from, filters.to));

  const groups = new Map<string, ImpactReport["byCropAndGrade"][number]>();
  for (const delivery of scopedDeliveries) {
    const key = `${delivery.cropId}:${delivery.gradeId}`;
    const group = groups.get(key) ?? { cropName: crops.find((crop) => crop.id === delivery.cropId)?.name ?? delivery.cropId, gradeName: hubCrops.find((hubCrop) => hubCrop.cropId === delivery.cropId)?.grades.find((grade) => grade.gradeId === delivery.gradeId)?.name ?? delivery.gradeId, deliveries: 0, thousandths: 0, amountOwedMinor: 0 };
    group.deliveries += 1;
    group.thousandths += toThousandths(delivery.kilograms);
    group.amountOwedMinor += delivery.amountOwedMinor;
    groups.set(key, group);
  }

  return {
    farmersRegistered: farmers.filter((farmer) => inCooperative(farmer.cooperativeId) && inPeriod(farmer.createdAt, undefined, filters.to)).length,
    farmersReached: reached.length,
    womenReached,
    womenShare: reached.length ? womenReached / reached.length : null,
    deliveries: scopedDeliveries.length,
    deliveredThousandths: scopedDeliveries.reduce((sum, delivery) => sum + toThousandths(delivery.kilograms), 0),
    amountOwedMinor: scopedDeliveries.reduce((sum, delivery) => sum + delivery.amountOwedMinor, 0),
    totalPaidMinor: succeeded.reduce((sum, payout) => sum + payout.amountMinor, 0),
    averageDaysToPayout: null,
    rawReceivedThousandths,
    tracedRawThousandths,
    localSourcingShare: rawReceivedThousandths ? tracedRawThousandths / rawReceivedThousandths : null,
    byCropAndGrade: [...groups.values()].sort((a, b) => b.thousandths - a.thousandths),
  };
}
