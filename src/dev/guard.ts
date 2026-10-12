// Dev tools exist only in development builds.
export const devToolsEnabled = process.env.NODE_ENV !== "production";

export function devToolsNotFound(): Response | null {
  return devToolsEnabled ? null : new Response("Not found", { status: 404 });
}
