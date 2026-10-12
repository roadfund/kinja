// A tooltip attached to a chart mark as data-tip: a title and label/value rows.
export type Tip = { title: string; rows: Array<[string, string]> };
export const tipAttr = (tip: Tip) => JSON.stringify(tip);
