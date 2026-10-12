// Shared table styles: one value per cell, no wrapping, the first column pinned while the
// table scrolls sideways on narrow screens.
export const tableFrame = "mt-5 max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-[#dce2d9] bg-white [-webkit-overflow-scrolling:touch]";
export const tableClass = "w-full min-w-max border-separate border-spacing-0 text-left text-sm";
export const headCell = "whitespace-nowrap border-b border-[#dce2d9] bg-[#f7f9f5] px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-[#718074] first:sticky first:left-0 first:z-10";
export const bodyCell = "whitespace-nowrap border-b border-[#eef1eb] bg-white px-4 py-3.5 text-[#5d685e] first:sticky first:left-0 first:z-10 group-last:border-b-0";
