import { createUuidV7 } from "@/domain/id";
import { hashPassword, verifyPassword } from "@/auth/password";
import { createToken, hashToken } from "@/auth/tokens";
import { getRepository } from "@/repositories/server";
import type { Hub, Membership, Organization, User } from "@/domain/model";
import type { HubOnboarding } from "@/auth/hub-onboarding";

export type PendingSignup = { fullName: string; username: string; phone: string; email?: string; photoUrl?: string; passwordHash: string; passwordSalt: string };
export type Account = { user: User; hub?: Hub; membership?: Membership; organization?: Organization };
type SessionResult = { account: Account; sessionToken: string };

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PLATFORM_HUB_ID = "platform";

// Signups wait here for up to an hour while the person fills in onboarding.
const runtime = globalThis as typeof globalThis & { __kinjaPendingSignups?: Map<string, PendingSignup> };
const pendingSignups = runtime.__kinjaPendingSignups ??= new Map();

export function savePendingSignup(signup: PendingSignup): string {
  const token = createUuidV7();
  pendingSignups.set(token, signup);
  return token;
}

export function consumePendingSignup(token: string): PendingSignup | null {
  const signup = pendingSignups.get(token) ?? null;
  pendingSignups.delete(token);
  return signup;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const wanted = username.trim().toLowerCase();
  return (await getRepository().list("User")).find((user) => user.username.toLowerCase() === wanted) ?? null;
}

export async function findUserByUsernameOrEmail(identifier: string): Promise<User | null> {
  const wanted = identifier.trim().toLowerCase();
  return (await getRepository().list("User")).find((user) => user.username.toLowerCase() === wanted || user.email?.toLowerCase() === wanted) ?? null;
}

export async function loadAccount(userId: string): Promise<Account | null> {
  const repository = getRepository();
  const user = await repository.get("User", userId);
  if (!user) return null;
  const memberships = (await repository.list("Membership")).filter((item) => item.userId === userId);
  // A suspended membership is still loaded, so authorization can say why access is blocked.
  const membership = memberships.find((item) => item.status === "ACTIVE") ?? memberships.find((item) => item.status === "SUSPENDED");
  const hub = membership && membership.hubId !== PLATFORM_HUB_ID ? await repository.get("Hub", membership.hubId) : null;
  const organization = membership?.organizationId ? await repository.get("Organization", membership.organizationId, membership.hubId) : null;
  return { user, membership, hub: hub ?? undefined, organization: organization ?? undefined };
}

export async function createSession(userId: string, now = new Date()): Promise<string> {
  const token = createToken();
  const timestamp = now.toISOString();
  await getRepository().put("Session", { id: createUuidV7(), tokenHash: await hashToken(token), userId, expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(), createdById: userId, createdAt: timestamp, updatedAt: timestamp });
  return token;
}

export async function getAccountFromSession(sessionToken: string | undefined, now = new Date()): Promise<Account | null> {
  if (!sessionToken) return null;
  const tokenHash = await hashToken(sessionToken);
  const session = (await getRepository().list("Session")).find((item) => item.tokenHash === tokenHash);
  if (!session || new Date(session.expiresAt) <= now) return null;
  return loadAccount(session.userId);
}

export async function deleteSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  const tokenHash = await hashToken(sessionToken);
  const session = (await getRepository().list("Session")).find((item) => item.tokenHash === tokenHash);
  if (session) await getRepository().remove("Session", session.id);
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  const repository = getRepository();
  for (const session of await repository.list("Session")) if (session.userId === userId) await repository.remove("Session", session.id);
}

export async function createHubAccount(signup: PendingSignup, input: HubOnboarding, now = new Date()): Promise<SessionResult> {
  const repository = getRepository();
  const timestamp = now.toISOString();
  const user: User = { id: createUuidV7(), fullName: signup.fullName, username: signup.username, phone: signup.phone, email: signup.email, photoUrl: signup.photoUrl, passwordHash: signup.passwordHash, passwordSalt: signup.passwordSalt, createdById: "self", createdAt: timestamp, updatedAt: timestamp };
  const hub: Hub = { id: createUuidV7(), countryId: input.countryId, businessName: input.businessName, status: "PENDING_VERIFICATION", regionOrCounty: input.regionOrCounty, physicalAddress: input.physicalAddress, gps: input.gps, businessCategory: input.businessCategory, yearEstablished: input.yearEstablished, businessRegistrationNumber: input.registrationNumber, registrationCertificateUrl: input.registrationCertificateUrl, taxId: input.taxId, contactPerson: { fullName: input.contactName, title: input.contactTitle, phone: input.contactPhone, email: input.contactEmail }, mainCropIds: [], approximateFarmerCount: input.approximateFarmerCount, approximateCooperativeCount: input.approximateCooperativeCount, logoUrl: input.logoUrl, websiteOrSocialPage: input.websiteOrSocialPage, createdById: user.id, createdAt: timestamp, updatedAt: timestamp };
  const membership: Membership = { id: createUuidV7(), userId: user.id, hubId: hub.id, role: "HUB_ADMIN", status: "ACTIVE", createdById: user.id, createdAt: timestamp, updatedAt: timestamp };
  await repository.put("User", user);
  await repository.put("Hub", hub);
  await repository.put("Membership", membership);
  return { account: { user, hub, membership }, sessionToken: await createSession(user.id, now) };
}

// An account joining through an invite: the membership comes from the invite.
export async function createUser(signup: PendingSignup, now = new Date()): Promise<User> {
  const timestamp = now.toISOString();
  const user: User = { id: createUuidV7(), fullName: signup.fullName, username: signup.username, phone: signup.phone, email: signup.email, photoUrl: signup.photoUrl, passwordHash: signup.passwordHash, passwordSalt: signup.passwordSalt, createdById: "self", createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("User", user);
  return user;
}

// The tech admin cannot sign up; their account is created from environment
// variables the first time they sign in.
async function ensureTechAdmin(username: string, password: string): Promise<void> {
  const { TECH_ADMIN_USERNAME, TECH_ADMIN_PASSWORD } = process.env;
  if (!TECH_ADMIN_USERNAME || !TECH_ADMIN_PASSWORD || username !== TECH_ADMIN_USERNAME || password !== TECH_ADMIN_PASSWORD) return;
  if (await findUserByUsername(username)) return;
  await createUserWithMembership({ id: "tech-admin", fullName: "Kinja Tech Admin", username, phone: process.env.TECH_ADMIN_PHONE || undefined, password, role: "TECH_ADMIN", hubId: PLATFORM_HUB_ID });
}

export async function createUserWithMembership(input: { id?: string; fullName: string; username: string; phone?: string; email?: string; photoUrl?: string; password: string; role: Membership["role"]; hubId: string; organizationId?: string }, now = new Date()): Promise<User> {
  const timestamp = now.toISOString();
  const passwordHash = await hashPassword(input.password);
  const user: User = { id: input.id ?? createUuidV7(), fullName: input.fullName, username: input.username, phone: input.phone, email: input.email, photoUrl: input.photoUrl, passwordHash, passwordSalt: passwordHash.split(".")[0], createdById: "system", createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("User", user);
  await getRepository().put("Membership", { id: createUuidV7(), userId: user.id, hubId: input.hubId, organizationId: input.organizationId, role: input.role, status: "ACTIVE", createdById: "system", createdAt: timestamp, updatedAt: timestamp });
  return user;
}

export async function authenticate(username: string, password: string): Promise<SessionResult | null> {
  await ensureTechAdmin(username, password);
  const user = await findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  const account = await loadAccount(user.id);
  return account ? { account, sessionToken: await createSession(user.id) } : null;
}

export function dashboardPath(account: Account): string {
  if (account.membership?.role === "TECH_ADMIN") return "/dashboard/admin";
  if (account.membership?.role === "HUB_ADMIN") return account.hub?.status === "PENDING_VERIFICATION" ? "/auth/pending" : "/dashboard/hub";
  if (account.membership?.role === "COOP_LEAD" || account.membership?.role === "FIELD_STAFF") return "/dashboard/cooperative";
  if (account.membership?.role === "MANUFACTURER") return "/dashboard/manufacturer";
  if (account.membership?.role === "DISTRIBUTOR") return "/dashboard/distributor";
  return "/auth/login";
}
