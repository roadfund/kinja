// Dev tools (seed, reset, account switcher, sheet import) exist only in development builds,
// and never while connected to a real database: their reset and seed buttons would wipe it.
export const devToolsEnabled = process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL;

export function devToolsNotFound(): Response | null {
  return devToolsEnabled ? null : new Response("Not found", { status: 404 });
}
