// Shown instantly while a dashboard page loads; the sidebar stays in place around it.
export function PageSkeleton() {
  const bar = "rounded-lg bg-[#e3e8df]";
  return <section aria-busy="true" aria-label="Loading" className="animate-pulse px-4 py-8 sm:px-10">
    <div className={`${bar} h-3 w-28`} />
    <div className={`${bar} mt-4 h-9 w-72 max-w-full`} />
    <div className={`${bar} mt-4 h-4 w-[28rem] max-w-full`} />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((card) => <div className="rounded-2xl bg-white p-5" key={card}><div className={`${bar} h-3 w-24`} /><div className={`${bar} mt-4 h-8 w-32`} /><div className={`${bar} mt-3 h-3 w-20`} /></div>)}</div>
    <div className="mt-10 overflow-hidden rounded-2xl border border-[#dce2d9] bg-white">
      <div className="h-11 bg-[#f7f9f5]" />
      {[0, 1, 2, 3, 4, 5].map((row) => <div className="flex gap-6 border-t border-[#eef1eb] px-4 py-4" key={row}><div className={`${bar} h-3 w-24`} /><div className={`${bar} h-3 w-40`} /><div className={`${bar} h-3 w-20`} /><div className={`${bar} ml-auto h-3 w-24`} /></div>)}
    </div>
  </section>;
}
