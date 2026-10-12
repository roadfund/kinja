import { createUuidV7 } from "@/domain/id";
import type { OutboxEmail } from "@/domain/model";
import { getRepository } from "@/repositories/server";

// Every email Kinja sends goes through here. There is no email provider yet, so
// messages are only recorded in the outbox (visible in dev tools at /dev).
// Plug a provider adapter in here when one is chosen.
export async function sendEmail(input: { to: string; subject: string; text: string; link?: string }, now = new Date()): Promise<OutboxEmail> {
  const timestamp = now.toISOString();
  const email: OutboxEmail = { id: createUuidV7(), ...input, createdById: "system", createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("OutboxEmail", email);
  return email;
}

export async function listOutbox(): Promise<OutboxEmail[]> {
  return (await getRepository().list("OutboxEmail")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
