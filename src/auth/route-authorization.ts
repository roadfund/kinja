import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import type { OrganizationType, Role } from "@/domain/model";
import { AuthorizationError, requireOrganizationScope, requireRole, type OrganizationScope, type Scope } from "@/auth/authorization";
import { dashboardPath, getAccountFromSession, type Account } from "@/auth/server-store";

export async function getCurrentAccount(): Promise<Account | null> {
  return getAccountFromSession((await cookies()).get("kinja_session")?.value);
}

// For pages: sends people who may not see the page somewhere they can go.
export async function requireDashboardRole(allowedRoles: Role[], options: { verifiedHub?: boolean } = {}): Promise<Account & { scope: Scope }> {
  const account = await getCurrentAccount();
  if (!account) redirect("/auth/login");
  if (!account.membership || !allowedRoles.includes(account.membership.role)) redirect(dashboardPath(account));
  try {
    return { ...account, scope: requireRole(account, allowedRoles, options) };
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    // The role is right but the hub or membership blocks access.
    redirect(account.membership.role === "HUB_ADMIN" && account.hub?.status === "PENDING_VERIFICATION" ? "/dashboard/hub" : "/auth/login?error=unavailable");
  }
}

// For organization pages: also requires membership of an organization of that type in the hub.
export async function requireOrganizationMember(roles: Role[], type: OrganizationType): Promise<Account & { scope: OrganizationScope }> {
  const account = await requireDashboardRole(roles);
  try {
    return { ...account, scope: requireOrganizationScope(account, roles, type) };
  } catch {
    redirect("/auth/login?error=unavailable");
  }
}

export function requireCooperativeMember(): Promise<Account & { scope: OrganizationScope }> {
  return requireOrganizationMember(["COOP_LEAD", "FIELD_STAFF"], "COOPERATIVE");
}

// For API routes: resolves the signed-in account or throws an AuthorizationError.
export async function requireApiAccount(): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) throw new AuthorizationError("Sign in to continue", 401);
  return account;
}

// Names the first field that failed, e.g. "Contact email: Invalid email address".
function describeIssue(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Some details are missing or invalid.";
  const field = issue.path.filter((part) => typeof part === "string").pop();
  const label = typeof field === "string" ? field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()).replace(/ Url$/, "").replace(/ Id(s)?$/, "") : "";
  return label ? `${label}: ${issue.message}` : issue.message;
}

// Turns errors thrown while handling an API request into JSON responses.
export function apiErrorResponse(error: unknown): Response {
  if (error instanceof AuthorizationError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return Response.json({ error: "Some details are missing or invalid." }, { status: 400 });
  if (error instanceof ZodError) return Response.json({ error: describeIssue(error) }, { status: 400 });
  if (error instanceof Error) return Response.json({ error: error.message }, { status: 422 });
  throw error;
}
