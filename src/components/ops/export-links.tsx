import { ExportMenu } from "@/components/ops/export-menu";
import { datasetLabels, type ExportDataset } from "@/ops/exports";

// The "Export" button for the datasets on a page. The server decides what the role may export.
export function ExportLinks({ datasets, hubId }: { datasets: ExportDataset[]; hubId?: string }) {
  return <ExportMenu datasets={datasets.map((dataset) => ({ dataset, label: datasetLabels[dataset] }))} hubId={hubId} />;
}
