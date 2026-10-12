export default function AuthLoading() {
  return <main className="grid min-h-screen animate-pulse bg-[var(--kinja-cream)] lg:grid-cols-2" aria-busy="true" aria-label="Loading">
    <div className="hidden bg-[#d9dfd4] lg:block" />
    <section className="flex items-center px-6 py-12 sm:px-16"><div className="mx-auto w-full max-w-md">
      <div className="h-5 w-20 rounded bg-[#d9dfd4]" />
      <div className="mt-8 h-10 w-3/4 rounded bg-[#d9dfd4]" />
      <div className="mt-4 h-5 w-full rounded bg-[#d9dfd4]" />
      <div className="mt-8 space-y-5"><div className="h-12 rounded-xl bg-white" /><div className="h-12 rounded-xl bg-white" /><div className="h-12 rounded-xl bg-[var(--kinja-green)]/30" /></div>
    </div></section>
  </main>;
}