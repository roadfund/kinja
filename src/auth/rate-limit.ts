// Fixed-window rate limiting kept in server memory. Good enough for a single
// server; move it to a shared store (e.g. Redis) when running several instances.
type Window = { count: number; resetsAt: number };
export type RateLimitRule = { limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

const runtime = globalThis as typeof globalThis & { __kinjaRateLimits?: Map<string, Window> };
const windows = runtime.__kinjaRateLimits ??= new Map();

export const rateLimits = {
  loginPerUsername: { limit: 5, windowMs: 15 * 60 * 1000 },
  loginPerIp: { limit: 30, windowMs: 15 * 60 * 1000 },
  signupPerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  resetPerAccount: { limit: 3, windowMs: 60 * 60 * 1000 },
  resetPerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  invitePerIp: { limit: 20, windowMs: 15 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

export function consumeRateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const current = windows.get(key);
  const window = current && current.resetsAt > now ? current : { count: 0, resetsAt: now + rule.windowMs };
  window.count += 1;
  windows.set(key, window);
  return { allowed: window.count <= rule.limit, retryAfterSeconds: Math.ceil((window.resetsAt - now) / 1000) };
}

export function resetRateLimit(key: string): void {
  windows.delete(key);
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
}
