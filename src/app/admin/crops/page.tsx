import { getMoneyContext } from "@/admin/exchange-rates";
import { getCropSetup } from "@/admin/hub-crop-setup";
import { formatRate, rateAt } from "@/domain/currency";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { CropSetupCard } from "./crop-setup-form";

export default async function CropSetupPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const { currency, crops } = await getCropSetup(account);
  const enabled = crops.filter((crop) => crop.enabled);
  const money = await getMoneyContext(account.hub!);
  const others = money.currencies.filter((code) => code !== currency);
  const rates = others.map((code) => { const rate = rateAt(money, code); return rate ? `1 ${code} = ${formatRate(rate)} ${currency}` : `${code} rate not set`; });
  return <DashboardShell back={{ href: "/admin/setup", label: "Hub setup" }} eyebrow="Hub setup" title="Crops, grades and prices" description={`Choose the crops your hub works with from the Kinja master list, then set a price per kg for each grade in ${currency}. Deliveries keep the price at the moment they are recorded, so changes only affect new deliveries.`}>
    <SummaryGrid columns={3}>
      <SummaryCard detail={`of ${crops.length} on the master list`} label="Enabled crops" value={enabled.length} />
      <SummaryCard detail="Across enabled crops" label="Grades" value={enabled.reduce((sum, crop) => sum + crop.grades.length, 0)} />
      <SummaryCard detail={others.length ? rates.join(" · ") : "Amounts are stored in whole minor units"} label="Currency" value={[currency, ...others].join(" · ")} />
    </SummaryGrid>
    <div className="mt-8 grid gap-4 xl:grid-cols-2">{crops.map((crop) => <CropSetupCard crop={crop} currency={currency} key={crop.cropId} money={money} />)}</div>
    {crops.length === 0 && <p className="mt-8 rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">The master crop list is empty. A Kinja tech admin needs to add crops first.</p>}
  </DashboardShell>;
}
