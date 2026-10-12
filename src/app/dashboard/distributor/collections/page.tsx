import { Wallet } from "lucide-react";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, EmptyState, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { CollectionsTable } from "@/components/market/market-tables";
import { getMoneyContext } from "@/admin/exchange-rates";
import { formatIn, moneyItem } from "@/domain/currency";
import { listCollections } from "@/market/market-service";

export default async function CollectionsPage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [collections, money] = await Promise.all([listCollections(account), getMoneyContext(account.hub!)]);
  const live = collections.filter((collection) => !collection.voidedAt);
  const items = (method?: string) => live.filter((collection) => !method || collection.method === method).map((collection) => moneyItem(collection.amountMinor, collection.currency, collection.receivedAt));
  return <DashboardShell eyebrow="Kinja Market" title="Collections" description="Payments received from customers against invoices. Record new ones from the invoice.">
    {/* One row of cards per currency, each total converted into that currency. */}
    <div className="space-y-4">{money.currencies.map((currency) => <SummaryGrid key={currency}>
      <SummaryCard detail={`${live.length} payments`} label={`Collected · ${currency}`} value={formatIn(money, items(), currency)} />
      <SummaryCard detail="Mobile money" label={`Mobile money · ${currency}`} value={formatIn(money, items("MOBILE_MONEY"), currency)} />
      <SummaryCard detail="Cash" label={`Cash · ${currency}`} value={formatIn(money, items("CASH"), currency)} />
      <SummaryCard detail="Bank transfer" label={`Bank · ${currency}`} value={formatIn(money, items("BANK_TRANSFER"), currency)} />
    </SummaryGrid>)}</div>
    <SectionHeader title="All collections" />
    {collections.length === 0 ? <EmptyState description="Open an invoice to record a payment against it." icon={<Wallet size={22} aria-hidden="true" />} title="No collections yet" /> : <CollectionsTable collections={collections} money={money} />}
  </DashboardShell>;
}
